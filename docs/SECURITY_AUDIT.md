# StockTracker Security Audit Report

**Audit Date:** December 2025
**Auditor:** DevSecOps Security Review
**Application Version:** 1.0.0
**Overall Security Grade:** B+ (Good foundation, critical gaps)

---

## Executive Summary

StockTracker demonstrates a **solid security foundation** with proper implementation of many security best practices including bcrypt password hashing, CSRF protection with double-submit cookies, session security configuration, and rate limiting on authentication endpoints. The codebase shows security-conscious development patterns.

However, the audit identified **2 critical vulnerabilities** that must be addressed before production deployment:

1. **MFA Bypass** - Users with MFA enabled can authenticate with password alone
2. **MFA Secrets Stored in Plaintext** - Database breach would expose all TOTP secrets

Additionally, **8 high-severity issues** were found related to session management, access control, and security headers that could lead to account takeover or data exposure.

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Immediate action required |
| High | 8 | Address within 2 weeks |
| Medium | 10 | Address within 1 month |
| Low | 4 | Address as time permits |

---

## Audit Methodology

### Scope

- **Backend:** Node.js/Express API (`backend/src/`)
- **Frontend:** React SPA (`frontend/src/`)
- **Database:** SQLite with better-sqlite3
- **External Integrations:** Finnhub, Alpha Vantage, Yahoo Finance APIs

### Assessment Categories

1. **Authentication & Authorization** - Login flows, session management, MFA implementation
2. **Input Validation** - SQL injection, XSS, command injection
3. **Data Protection** - Encryption at rest, sensitive data handling
4. **Security Headers** - CSP, CORS, HSTS, X-Frame-Options
5. **API Security** - Rate limiting, authentication requirements
6. **Configuration** - Environment variables, secrets management

### Tools & Techniques

- Manual code review of all route handlers and middleware
- Static analysis of security-sensitive patterns
- Configuration review of Express middleware stack
- Database schema analysis for sensitive data storage

---

## Detailed Findings

### CRITICAL Vulnerabilities

#### C1: MFA Not Enforced During Login

**Severity:** Critical
**CVSS Score:** 9.1
**Location:** `backend/src/routes/auth.js:264-316`
**CWE:** CWE-287 (Improper Authentication)

**Description:**
The login endpoint completes authentication after successful password verification without checking if the user has MFA enabled. Users who have configured TOTP-based MFA can still log in using only their password, completely bypassing the second authentication factor.

**Vulnerable Code:**
```javascript
// auth.js - POST /api/auth/login
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const validPassword = await bcrypt.compare(password, user.password);

if (validPassword) {
  // Session is created immediately - MFA check missing!
  req.session.userId = user.id;
  return res.json({ success: true, user: sanitizedUser });
}
```

**Impact:**
- Complete bypass of MFA protection
- Renders MFA security feature ineffective
- Account takeover possible with just stolen password

**Recommendation:**
Check `user.mfa_enabled` after password verification. If enabled, return a partial authentication state requiring MFA verification before completing the session.

---

#### C2: MFA Secrets Stored in Plaintext

**Severity:** Critical
**CVSS Score:** 8.7
**Location:** `backend/src/services/mfa.js:150-152`, `backend/src/database.js:59`
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

**Description:**
TOTP secrets are stored directly in the database without encryption. A database breach (via SQL injection, backup theft, or unauthorized access) would expose all MFA secrets, allowing attackers to generate valid TOTP codes for any user.

**Vulnerable Code:**
```javascript
// mfa.js - setupMFA function
const secret = speakeasy.generateSecret({ length: 20 });
db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?')
  .run(secret.base32, userId);  // Stored as plaintext!
```

**Database Schema:**
```sql
-- database.js
mfa_secret TEXT,  -- No encryption indication
```

**Impact:**
- Database breach exposes all MFA secrets
- Attackers can generate valid TOTP codes for any user
- Mass account takeover possible
- Defeats purpose of MFA entirely

**Recommendation:**
Encrypt MFA secrets using the existing `encryption.js` utility before storage. Decrypt only when validating TOTP codes.

---

### HIGH Severity Vulnerabilities

#### H1: Backup Codes Not Hashed

**Severity:** High
**Location:** `backend/src/services/mfa.js:37-44`
**CWE:** CWE-257 (Storing Passwords in Recoverable Format)

**Description:**
MFA backup codes are stored as plaintext JSON array. Database exposure reveals all recovery codes.

**Vulnerable Code:**
```javascript
const backupCodes = Array.from({ length: 10 }, () =>
  crypto.randomBytes(4).toString('hex').toUpperCase()
);
db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?')
  .run(JSON.stringify(backupCodes), userId);  // Plaintext!
```

**Recommendation:**
Hash each backup code with bcrypt before storage. Compare using bcrypt during validation.

---

#### H2: Password Change Doesn't Invalidate Other Sessions

**Severity:** High
**Location:** `backend/src/routes/auth.js:439-469`
**CWE:** CWE-613 (Insufficient Session Expiration)

**Description:**
When a user changes their password, existing sessions remain valid. If an attacker has compromised a session, changing the password doesn't revoke their access.

**Vulnerable Code:**
```javascript
// auth.js - POST /api/auth/change-password
db.prepare('UPDATE users SET password = ? WHERE id = ?')
  .run(hashedPassword, userId);
// No session invalidation!
res.json({ success: true });
```

**Recommendation:**
After password change, invalidate all sessions except the current one using session store cleanup.

---

#### H3: Failed Login Tracking Only In-Memory

**Severity:** High
**Location:** `backend/src/services/securityLogger.js:119-122`
**CWE:** CWE-778 (Insufficient Logging)

**Description:**
Failed login attempts are tracked using an in-memory Map. Server restart clears all tracking, allowing brute-force attacks to resume without delay.

**Vulnerable Code:**
```javascript
const failedAttempts = new Map();  // Lost on restart

export function recordFailedLogin(ip, email) {
  const key = `${ip}:${email}`;
  const attempts = failedAttempts.get(key) || { count: 0 };
  // ... tracking logic
}
```

**Recommendation:**
Persist failed login attempts to the database with automatic cleanup of old entries.

---

#### H4: CSP Allows unsafe-inline

**Severity:** High
**Location:** `backend/src/index.js:25-39`
**CWE:** CWE-79 (Cross-site Scripting)

**Description:**
Content Security Policy includes `'unsafe-inline'` for scripts, which defeats XSS protection. Any successful XSS injection can execute arbitrary JavaScript.

**Vulnerable Code:**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Defeats CSP!
    },
  },
}));
```

**Recommendation:**
Remove `'unsafe-inline'` and use nonce-based CSP or refactor inline scripts to external files.

---

#### H5: CORS Allows No-Origin Requests with Credentials

**Severity:** High
**Location:** `backend/src/index.js:46-61`
**CWE:** CWE-942 (Overly Permissive Cross-domain Whitelist)

**Description:**
CORS configuration allows requests without an Origin header when credentials are enabled. Non-browser clients (curl, scripts) can make authenticated requests.

**Vulnerable Code:**
```javascript
cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // Allows no-origin!
    // ... rest of validation
  },
  credentials: true,
})
```

**Recommendation:**
In production, require Origin header for all credentialed requests.

---

#### H6: Missing Authentication on Quote Endpoints

**Severity:** High
**Location:** `backend/src/routes/quotes.js:10-29`
**CWE:** CWE-306 (Missing Authentication for Critical Function)

**Description:**
Quote endpoints (`/api/quotes/:symbol`, `/api/quotes/batch`) don't require authentication, allowing unauthorized API consumption and potential abuse of rate-limited external APIs.

**Vulnerable Code:**
```javascript
// quotes.js - No auth middleware
router.get('/:symbol', async (req, res) => {
  const quote = await getQuote(req.params.symbol);
  res.json(quote);
});
```

**Recommendation:**
Add authentication middleware to all quote endpoints to track usage per user.

---

#### H7: IDOR Vulnerability in Watchlist Operations

**Severity:** High
**Location:** `backend/src/routes/watchlists.js:54-58`
**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)

**Description:**
Watchlist item retrieval only validates watchlist ID without verifying ownership. Users can access items from other users' watchlists by guessing IDs.

**Vulnerable Code:**
```javascript
router.get('/:id/items', requireAuth, async (req, res) => {
  const { id } = req.params;
  // Missing ownership check!
  const items = db.prepare('SELECT * FROM watchlist_items WHERE watchlist_id = ?')
    .all(id);
  res.json(items);
});
```

**Recommendation:**
Join with watchlists table and verify `user_id` matches the authenticated user.

---

#### H8: DB Encryption Key Not Enforced in Production

**Severity:** High
**Location:** `backend/src/utils/encryption.js:22-32`
**CWE:** CWE-321 (Use of Hard-coded Cryptographic Key)

**Description:**
The encryption utility falls back to a development key when `DB_ENCRYPTION_KEY` is not set, potentially leaving production data encrypted with a known/weak key.

**Vulnerable Code:**
```javascript
const keyHex = process.env.DB_ENCRYPTION_KEY;
if (!keyHex) {
  console.warn('DB_ENCRYPTION_KEY not set, using development key');
  // Falls back to insecure default
}
```

**Recommendation:**
Exit with fatal error in production if encryption key is not configured.

---

### MEDIUM Severity Vulnerabilities

#### M1: Session Secret Has Hardcoded Fallback

**Location:** `backend/src/index.js:67-78`
**CWE:** CWE-798 (Hard-coded Credentials)

The session secret has a fallback value used when `SESSION_SECRET` environment variable is not set. This could lead to predictable session tokens in development environments that may be accidentally deployed to production.

---

#### M2: Error Messages Expose Internal Details

**Location:** Multiple route files
**CWE:** CWE-209 (Information Exposure Through Error Message)

Error responses include `error.message` which may expose internal implementation details, stack traces, or sensitive information to clients.

---

#### M3: Missing HTTP Security Headers

**Location:** `backend/src/index.js`
**CWE:** CWE-693 (Protection Mechanism Failure)

While helmet is configured, some important headers are not explicitly set:
- HSTS with preload
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin

---

#### M4: 24-Hour Session Timeout Too Long

**Location:** `backend/src/index.js:85-90`
**CWE:** CWE-613 (Insufficient Session Expiration)

Session maxAge is set to 24 hours, providing an extended window for session hijacking attacks.

---

#### M5: No MFA Setup Deadline/TTL

**Location:** `backend/src/services/mfa.js:48-67`
**CWE:** CWE-613 (Insufficient Session Expiration)

MFA secrets generated during setup have no expiration. Abandoned MFA setups leave unverified secrets in the database indefinitely.

---

#### M6: MFA Secrets Returned in API Responses

**Location:** `backend/src/services/mfa.js:154-163`
**CWE:** CWE-200 (Exposure of Sensitive Information)

MFA setup responses include the secret in multiple formats, increasing exposure surface. Consider returning only the QR code data URL.

---

#### M7: Dynamic SQL SET Clause Pattern

**Location:** `backend/src/routes/alerts.js:111-153`
**CWE:** CWE-89 (SQL Injection)

While parameterized, the dynamic SET clause construction pattern is error-prone and could lead to injection if not carefully maintained.

---

#### M8: Missing Rate Limiting on Quote Endpoints

**Location:** `backend/src/routes/quotes.js`
**CWE:** CWE-770 (Allocation of Resources Without Limits)

Quote endpoints lack rate limiting, allowing abuse of external API quotas and potential denial of service.

---

#### M9: Search Query Injection Risk

**Location:** `backend/src/routes/search.js:140-171`
**CWE:** CWE-89 (SQL Injection)

FTS5 search queries accept user input that could contain SQLite FTS operators. While not direct injection, malformed queries could cause errors or DoS.

---

#### M10: Secure Cookie Flag Only in Production

**Location:** `backend/src/index.js:86`
**CWE:** CWE-614 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute)

Session cookies only have the `secure` flag in production, potentially exposing session tokens over HTTP in development.

---

### LOW Severity Vulnerabilities

#### L1: Hardcoded CORS Origin for SSE

**Location:** `backend/src/routes/stream.js:40-41`

SSE endpoint has hardcoded CORS origin instead of using centralized configuration.

---

#### L2: No API Key Rotation Policy

**Location:** Database Schema

User API keys have no expiration or rotation mechanism. Long-lived keys increase exposure window if compromised.

---

#### L3: Source Maps Possibly in Production Build

**Location:** `frontend/vite.config.js`

Verify that production builds exclude source maps to prevent source code exposure.

---

#### L4: API Key Reveal Button in Frontend

**Location:** `frontend/src/components/api-keys/MaskedKeyDisplay.jsx`

While convenient, the reveal button keeps full API keys in memory. Consider only showing partial keys.

---

## Security Strengths

The following security measures are properly implemented:

1. **Password Hashing** - bcrypt with appropriate cost factor
2. **CSRF Protection** - Double-submit cookie pattern with rotation
3. **Session Fixation Protection** - Session regeneration on login
4. **Rate Limiting** - Login endpoint has progressive delays
5. **SQL Injection Prevention** - Parameterized queries throughout
6. **Secure Cookie Configuration** - httpOnly, sameSite settings
7. **Input Validation** - Email format validation, password requirements
8. **Audit Logging** - Security events are logged

---

## Compliance Notes

### OWASP Top 10 2021 Coverage

| Category | Status |
|----------|--------|
| A01 Broken Access Control | Issues found (H7 IDOR) |
| A02 Cryptographic Failures | Issues found (C2, H1, H8) |
| A03 Injection | Properly mitigated |
| A04 Insecure Design | N/A |
| A05 Security Misconfiguration | Issues found (H4, H5, M1-M3) |
| A06 Vulnerable Components | Not assessed |
| A07 Auth Failures | Critical issues (C1, H2, H3) |
| A08 Software/Data Integrity | Not assessed |
| A09 Security Logging Failures | Partial (H3) |
| A10 SSRF | Not applicable |

---

## Appendix: Files Reviewed

### Backend
- `src/index.js` - Express configuration
- `src/database.js` - Database schema
- `src/routes/auth.js` - Authentication endpoints
- `src/routes/quotes.js` - Quote endpoints
- `src/routes/watchlists.js` - Watchlist management
- `src/routes/search.js` - Symbol search
- `src/routes/alerts.js` - Price alerts
- `src/routes/stream.js` - SSE streaming
- `src/routes/api-keys.js` - API key management
- `src/services/mfa.js` - MFA implementation
- `src/services/securityLogger.js` - Security logging
- `src/utils/encryption.js` - Encryption utilities
- `src/middleware/auth.js` - Auth middleware

### Frontend
- `src/components/api-keys/*` - API key UI
- `src/stores/authStore.js` - Auth state
- `vite.config.js` - Build configuration

---

*This report was generated as part of a comprehensive DevSecOps security assessment.*
