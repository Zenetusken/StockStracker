import express from 'express';
import bcrypt from 'bcrypt';
import db from '../database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const BCRYPT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Create new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name)
      VALUES (?, ?, ?)
    `).run(email, passwordHash, name || null);

    const userId = result.lastInsertRowid;

    // Create default user preferences
    db.prepare(`
      INSERT INTO user_preferences (user_id)
      VALUES (?)
    `).run(userId);

    // Create default watchlist
    db.prepare(`
      INSERT INTO watchlists (user_id, name, is_default)
      VALUES (?, ?, 1)
    `).run(userId, 'My Watchlist');

    // Create default portfolio
    db.prepare(`
      INSERT INTO portfolios (user_id, name, description, is_default, cash_balance)
      VALUES (?, ?, ?, 1, ?)
    `).run(userId, 'My Portfolio', 'Default portfolio', 10000);

    // Get created user
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Failed to create user account'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Create session
    req.session.userId = user.id;
    req.session.email = user.email;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return res.status(500).json({
        error: 'Logout failed'
      });
    }
    res.json({
      message: 'Logout successful'
    });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, email, name, created_at, last_login_at
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info'
    });
  }
});

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters long'
      });
    }

    // Get user
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.session.userId);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[Auth] Password change error:', error);
    res.status(500).json({
      error: 'Failed to change password'
    });
  }
});

export default router;
