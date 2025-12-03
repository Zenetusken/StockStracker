# StockTracker Security Remediation Roadmap

This document provides actionable steps to address all vulnerabilities identified in the Security Audit Report. Fixes are organized by priority phase to ensure critical issues are resolved first.

---

## Quick Reference

| Phase | Focus | Issues | Goal |
|-------|-------|--------|------|
| 1 | Critical Fixes | C1, C2 | Block production deployment risks |
| 2 | High Priority | H1-H8 | Prevent account takeover & data exposure |
| 3 | Medium Priority | M1-M10 | Harden security posture |
| 4 | Low Priority | L1-L4 | Polish & best practices |

---

## Phase 1: Critical Fixes

### 1.1 Enforce MFA During Login (C1)

**File:** `backend/src/routes/auth.js`

**Current Issue:** Login completes after password verification without checking MFA status.

**Solution:** Implement two-step authentication for MFA-enabled users.

#### Step 1: Modify Login Endpoint

```javascript
// In POST /api/auth/login handler, after password verification succeeds:

// Check if user has MFA enabled
if (user.mfa_enabled === 1) {
  // Store user ID in session for MFA verification step
  req.session.pendingMfaUserId = user.id;
  req.session.pendingMfaTimestamp = Date.now();

  // Don't complete login - require MFA
  return res.status(202).json({
    success: false,
    mfaRequired: true,
    message: 'MFA verification required'
  });
}

// If MFA not enabled, proceed with normal login
req.session.userId = user.id;
// ... rest of login logic
```

#### Step 2: Create MFA Verification Endpoint

```javascript
// Add new endpoint in auth.js

router.post('/verify-mfa', async (req, res) => {
  const { code } = req.body;
  const pendingUserId = req.session.pendingMfaUserId;
  const pendingTimestamp = req.session.pendingMfaTimestamp;

  // Validate pending MFA session exists
  if (!pendingUserId) {
    return res.status(400).json({ error: 'No pending MFA verification' });
  }

  // Check MFA session hasn't expired (5 minute window)
  if (Date.now() - pendingTimestamp > 5 * 60 * 1000) {
    delete req.session.pendingMfaUserId;
    delete req.session.pendingMfaTimestamp;
    return res.status(401).json({ error: 'MFA session expired, please login again' });
  }

  // Get user and verify TOTP
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pendingUserId);
  const secret = decrypt(user.mfa_secret); // After implementing C2 fix

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: code,
    window: 1
  });

  if (!verified) {
    // Check backup codes
    const backupUsed = await verifyBackupCode(pendingUserId, code);
    if (!backupUsed) {
      return res.status(401).json({ error: 'Invalid MFA code' });
    }
  }

  // MFA verified - complete login
  delete req.session.pendingMfaUserId;
  delete req.session.pendingMfaTimestamp;
  req.session.userId = user.id;

  res.json({ success: true, user: sanitizeUser(user) });
});
```

#### Step 3: Update Frontend Login Flow

```javascript
// In frontend authStore.js or login handler

const response = await api.post('/auth/login', { email, password });

if (response.status === 202 && response.data.mfaRequired) {
  // Redirect to MFA verification screen
  return { mfaRequired: true };
}

// Normal login success handling
```

**Verification:**
1. Enable MFA for a test user
2. Attempt login with just password
3. Verify 202 response with `mfaRequired: true`
4. Submit valid TOTP code to `/verify-mfa`
5. Verify session is now authenticated

---

### 1.2 Encrypt MFA Secrets (C2)

**Files:** `backend/src/services/mfa.js`, `backend/src/utils/encryption.js`

**Current Issue:** MFA secrets stored as plaintext in database.

**Solution:** Encrypt secrets using existing encryption utility.

#### Step 1: Update MFA Setup

```javascript
// In mfa.js - setupMFA function

import { encrypt, decrypt } from '../utils/encryption.js';

export async function setupMFA(userId) {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `StockTracker:${userId}`
  });

  // Encrypt the secret before storing
  const encryptedSecret = encrypt(secret.base32);

  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?')
    .run(encryptedSecret, userId);

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    qrCode: qrCodeUrl,
    // Don't return raw secret - only QR code
  };
}
```

#### Step 2: Update MFA Verification

```javascript
// In mfa.js - verifyMFA function

export function verifyMFA(userId, token) {
  const user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(userId);

  if (!user?.mfa_secret) {
    return false;
  }

  // Decrypt the secret for verification
  const secret = decrypt(user.mfa_secret);

  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
}
```

#### Step 3: Migration Script for Existing Secrets

```javascript
// scripts/migrate-mfa-secrets.js

import Database from 'better-sqlite3';
import { encrypt } from '../src/utils/encryption.js';

const db = new Database('stocktracker.db');

const users = db.prepare('SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL').all();

for (const user of users) {
  // Skip if already encrypted (check for encryption prefix/format)
  if (user.mfa_secret.includes(':')) {
    console.log(`User ${user.id} secret already encrypted`);
    continue;
  }

  const encrypted = encrypt(user.mfa_secret);
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?')
    .run(encrypted, user.id);
  console.log(`Migrated user ${user.id}`);
}

console.log('Migration complete');
```

**Verification:**
1. Run migration script
2. Verify database contains encrypted secrets (should be longer, contain IV/tag)
3. Test MFA login still works
4. Verify raw database dump doesn't expose secrets

---

## Phase 2: High Priority Fixes

### 2.1 Hash Backup Codes (H1)

**File:** `backend/src/services/mfa.js`

```javascript
import bcrypt from 'bcrypt';

export async function generateBackupCodes(userId) {
  // Generate 10 random codes
  const codes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  // Hash each code before storage
  const hashedCodes = await Promise.all(
    codes.map(async (code) => ({
      hash: await bcrypt.hash(code, 10),
      used: false
    }))
  );

  // Store hashed codes
  db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?')
    .run(JSON.stringify(hashedCodes), userId);

  // Return plaintext codes to user (one-time display)
  return codes;
}

export async function verifyBackupCode(userId, code) {
  const user = db.prepare('SELECT backup_codes FROM users WHERE id = ?').get(userId);
  const codes = JSON.parse(user.backup_codes || '[]');

  for (let i = 0; i < codes.length; i++) {
    if (!codes[i].used && await bcrypt.compare(code.toUpperCase(), codes[i].hash)) {
      // Mark as used
      codes[i].used = true;
      db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?')
        .run(JSON.stringify(codes), userId);
      return true;
    }
  }

  return false;
}
```

---

### 2.2 Invalidate Sessions on Password Change (H2)

**File:** `backend/src/routes/auth.js`

```javascript
// In POST /api/auth/change-password handler, after updating password:

// Invalidate all other sessions for this user
const currentSessionId = req.session.id;

// If using database session store:
db.prepare('DELETE FROM sessions WHERE user_id = ? AND sid != ?')
  .run(userId, currentSessionId);

// If using memory store, you'll need to iterate:
// req.sessionStore.all((err, sessions) => {
//   for (const sid in sessions) {
//     if (sessions[sid].userId === userId && sid !== currentSessionId) {
//       req.sessionStore.destroy(sid);
//     }
//   }
// });

// Log the security event
securityLogger.log({
  event: 'PASSWORD_CHANGE_SESSIONS_INVALIDATED',
  userId,
  sessionsCleared: 'all_except_current'
});

res.json({ success: true, message: 'Password changed, other sessions logged out' });
```

---

### 2.3 Fix CSP Configuration (H4)

**File:** `backend/src/index.js`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],  // Removed 'unsafe-inline'
      styleSrc: ["'self'", "'unsafe-inline'"],  // Keep for Tailwind
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://finnhub.io", "https://www.alphavantage.co"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
```

**Note:** If inline scripts are required, implement nonce-based CSP:

```javascript
import crypto from 'crypto';

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Then in CSP:
scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`]
```

---

### 2.4 Restrict CORS No-Origin (H5)

**File:** `backend/src/index.js`

```javascript
app.use(cors({
  origin: (origin, callback) => {
    // In production, require origin header
    if (!origin && process.env.NODE_ENV === 'production') {
      return callback(new Error('Origin header required'), false);
    }

    // Allow requests without origin in development (curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));
```

---

### 2.5 Add Auth to Quote Endpoints (H6)

**File:** `backend/src/routes/quotes.js`

```javascript
import { requireAuth } from '../middleware/auth.js';

// Apply to all quote routes
router.use(requireAuth);

// Or selectively:
router.get('/:symbol', requireAuth, async (req, res) => {
  // ... existing handler
});

router.post('/batch', requireAuth, async (req, res) => {
  // ... existing handler
});
```

---

### 2.6 Fix IDOR in Watchlist Operations (H7)

**File:** `backend/src/routes/watchlists.js`

```javascript
// Fix GET /:id/items
router.get('/:id/items', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  // Verify ownership through JOIN
  const items = db.prepare(`
    SELECT wi.*
    FROM watchlist_items wi
    INNER JOIN watchlists w ON wi.watchlist_id = w.id
    WHERE wi.watchlist_id = ? AND w.user_id = ?
  `).all(id, userId);

  res.json(items);
});

// Apply same pattern to all watchlist operations:
// - PUT /:id
// - DELETE /:id
// - POST /:id/items
// - DELETE /:id/items/:itemId
```

---

### 2.7 Enforce DB Encryption Key (H8)

**File:** `backend/src/utils/encryption.js`

```javascript
const keyHex = process.env.DB_ENCRYPTION_KEY;

if (!keyHex) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: DB_ENCRYPTION_KEY environment variable is required in production');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  // Development fallback with warning
  console.warn('WARNING: Using development encryption key. DO NOT use in production!');
}

const key = keyHex
  ? Buffer.from(keyHex, 'hex')
  : Buffer.from('0'.repeat(64), 'hex');  // Weak dev key

if (key.length !== 32) {
  throw new Error('DB_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}
```

---

### 2.8 Persist Failed Login Tracking (H3)

**File:** `backend/src/database.js`

```sql
-- Add to schema
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  email TEXT,
  attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT
);

CREATE INDEX idx_failed_logins_ip ON failed_login_attempts(ip_address, attempt_time);
CREATE INDEX idx_failed_logins_email ON failed_login_attempts(email, attempt_time);
```

**File:** `backend/src/services/securityLogger.js`

```javascript
// Replace in-memory Map with database operations

export function recordFailedLogin(ip, email, userAgent) {
  db.prepare(`
    INSERT INTO failed_login_attempts (ip_address, email, user_agent)
    VALUES (?, ?, ?)
  `).run(ip, email, userAgent);

  // Clean up old entries (older than 24 hours)
  db.prepare(`
    DELETE FROM failed_login_attempts
    WHERE attempt_time < datetime('now', '-24 hours')
  `).run();
}

export function getFailedAttempts(ip, email, windowMinutes = 15) {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM failed_login_attempts
    WHERE (ip_address = ? OR email = ?)
    AND attempt_time > datetime('now', '-' || ? || ' minutes')
  `).get(ip, email, windowMinutes);

  return result.count;
}

export function isRateLimited(ip, email) {
  const attempts = getFailedAttempts(ip, email, 15);
  return attempts >= 5;  // 5 attempts in 15 minutes
}
```

---

## Phase 3: Medium Priority Fixes

### 3.1 Add Missing Security Headers (M3)

**File:** `backend/src/index.js`

```javascript
app.use(helmet({
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  // ... existing CSP config
}));
```

---

### 3.2 Fix Error Information Disclosure (M2)

Create error sanitization middleware:

**File:** `backend/src/middleware/errorHandler.js`

```javascript
export function errorHandler(err, req, res, next) {
  // Log full error for debugging
  console.error('Error:', err);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send sanitized response
  const response = {
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.message
    })
  };

  res.status(statusCode).json(response);
}
```

Apply in `index.js`:
```javascript
import { errorHandler } from './middleware/errorHandler.js';

// After all routes
app.use(errorHandler);
```

---

### 3.3 Reduce Session Timeout (M4)

**File:** `backend/src/index.js`

```javascript
app.use(session({
  // ... other config
  cookie: {
    maxAge: 1000 * 60 * 60 * 4,  // 4 hours instead of 24
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },
  rolling: true  // Reset expiry on activity
}));
```

---

### 3.4 Add MFA Setup TTL (M5)

**File:** `backend/src/services/mfa.js`

```javascript
export async function setupMFA(userId) {
  const secret = speakeasy.generateSecret({ length: 20 });
  const encryptedSecret = encrypt(secret.base32);

  // Add expiration timestamp (15 minutes)
  db.prepare(`
    UPDATE users SET
      mfa_secret = ?,
      mfa_setup_expires_at = datetime('now', '+15 minutes'),
      mfa_enabled = 0
    WHERE id = ?
  `).run(encryptedSecret, userId);

  // ... return QR code
}

export function confirmMFA(userId, token) {
  const user = db.prepare(`
    SELECT mfa_secret, mfa_setup_expires_at
    FROM users WHERE id = ?
  `).get(userId);

  // Check if setup has expired
  if (user.mfa_setup_expires_at && new Date(user.mfa_setup_expires_at) < new Date()) {
    // Clear expired setup
    db.prepare('UPDATE users SET mfa_secret = NULL WHERE id = ?').run(userId);
    throw new Error('MFA setup expired, please start again');
  }

  // Verify token and enable MFA
  // ...
}
```

---

### 3.5 Rate Limit Quote Endpoints (M8)

**File:** `backend/src/routes/quotes.js`

```javascript
import rateLimit from 'express-rate-limit';

const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,  // 60 requests per minute per user
  keyGenerator: (req) => req.session?.userId || req.ip,
  message: { error: 'Too many requests, please try again later' }
});

router.get('/:symbol', requireAuth, quoteLimiter, async (req, res) => {
  // ... handler
});

router.post('/batch', requireAuth, quoteLimiter, async (req, res) => {
  // ... handler
});
```

---

### 3.6 Add Search Query Validation (M9)

**File:** `backend/src/routes/search.js`

```javascript
router.get('/', async (req, res) => {
  const { q } = req.query;

  // Validate query
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  // Length limit
  if (q.length > 100) {
    return res.status(400).json({ error: 'Query too long' });
  }

  // Character whitelist (alphanumeric, spaces, common punctuation)
  if (!/^[a-zA-Z0-9\s\-\.]+$/.test(q)) {
    return res.status(400).json({ error: 'Invalid characters in query' });
  }

  // Escape FTS5 special characters
  const sanitizedQuery = q.replace(/[":*()]/g, '');

  // ... proceed with search
});
```

---

## Phase 4: Low Priority Fixes

### 4.1 Make SSE CORS Origin Configurable (L1)

**File:** `backend/src/routes/stream.js`

```javascript
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

router.get('/quotes', (req, res) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // ... rest of SSE setup
});
```

---

### 4.2 Implement API Key Rotation (L2)

**Database Schema:**
```sql
ALTER TABLE user_api_keys ADD COLUMN expires_at DATETIME;
ALTER TABLE user_api_keys ADD COLUMN last_rotated_at DATETIME;
```

**Notification Logic:**
```javascript
// Check for keys expiring soon (30 days)
const expiringKeys = db.prepare(`
  SELECT * FROM user_api_keys
  WHERE expires_at < datetime('now', '+30 days')
  AND expires_at > datetime('now')
`).all();

// Notify users to rotate keys
```

---

### 4.3 Disable Source Maps in Production (L3)

**File:** `frontend/vite.config.js`

```javascript
export default defineConfig({
  build: {
    sourcemap: process.env.NODE_ENV !== 'production'
  }
});
```

---

### 4.4 Remove API Key Reveal (L4)

Consider removing the "reveal" button entirely, or implement time-limited reveal with re-authentication:

**File:** `frontend/src/components/api-keys/MaskedKeyDisplay.jsx`

```javascript
// Option 1: Remove reveal entirely
// Show only masked version: ****-****-****-XXXX

// Option 2: Require password confirmation
const handleReveal = async () => {
  const password = await promptPassword();
  const verified = await api.post('/auth/verify-password', { password });
  if (verified) {
    setRevealed(true);
    // Auto-hide after 30 seconds
    setTimeout(() => setRevealed(false), 30000);
  }
};
```

---

## Testing Requirements

### Critical Fixes Testing

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| MFA Enforcement | 1. Enable MFA for user<br>2. Login with password only | Returns 202 with `mfaRequired: true` |
| MFA Completion | 1. Complete password step<br>2. Submit valid TOTP | Login succeeds, session created |
| Secret Encryption | 1. Query database directly<br>2. Check mfa_secret column | Secret is encrypted (not base32) |

### High Priority Testing

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Backup Code Hash | Query backup_codes column | Contains hashed values, not plaintext |
| Session Invalidation | Change password, check other sessions | Other sessions logged out |
| IDOR Prevention | Access another user's watchlist ID | Returns 403 or empty result |
| Auth on Quotes | Call /api/quotes/AAPL without session | Returns 401 |

---

## Deployment Checklist

Before deploying to production:

- [ ] `DB_ENCRYPTION_KEY` environment variable set (32 bytes hex)
- [ ] `SESSION_SECRET` environment variable set (strong random value)
- [ ] `NODE_ENV=production` set
- [ ] HTTPS configured with valid certificate
- [ ] CORS origins configured for production domain
- [ ] Source maps disabled in frontend build
- [ ] Database migrations run for new tables
- [ ] MFA secrets migrated to encrypted format
- [ ] Backup codes re-generated (users will need new codes)

---

## Monitoring & Ongoing Security

### Security Logging Events to Monitor

- Failed login attempts (threshold alerts)
- MFA setup/disable events
- Password changes
- Session anomalies (multiple IPs)
- API rate limit hits

### Regular Security Tasks

- Review security logs weekly
- Check for dependency vulnerabilities monthly
- Rotate encryption keys annually
- Penetration test before major releases

---

*Refer to SECURITY_AUDIT.md for detailed vulnerability descriptions and impact analysis.*
