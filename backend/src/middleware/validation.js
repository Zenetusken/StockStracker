import { body, param, query, validationResult } from 'express-validator';

/**
 * Input Validation Middleware
 *
 * Uses express-validator for comprehensive input sanitization and validation.
 * This prevents injection attacks, ensures data integrity, and provides
 * clear error messages to clients.
 */

/**
 * Handle validation errors - use as final middleware in validation chain
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: e.value !== undefined ? '[REDACTED]' : undefined // Don't expose passwords
      }))
    });
  }
  next();
};

/**
 * Auth validators
 */
export const authValidators = {
  register: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
      .isLength({ max: 128 }).withMessage('Password must be less than 128 characters'),

    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters')
      .matches(/^[a-zA-Z0-9\s\-'\.]+$/).withMessage('Name contains invalid characters'),

    handleValidationErrors
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required'),

    handleValidationErrors
  ],

  passwordChange: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),

    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 12 }).withMessage('New password must be at least 12 characters')
      .isLength({ max: 128 }).withMessage('New password must be less than 128 characters'),

    handleValidationErrors
  ]
};

/**
 * Watchlist validators
 */
export const watchlistValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters')
      .escape(), // Escape HTML entities

    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color (e.g., #3B82F6)'),

    body('icon')
      .optional()
      .isIn(['star', 'heart', 'chart', 'rocket', 'fire', 'target', 'crown', 'alien', 'octopus', 'folder', 'bookmark'])
      .withMessage('Invalid icon'),

    handleValidationErrors
  ],

  update: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid watchlist ID'),

    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters')
      .escape(),

    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color'),

    body('icon')
      .optional()
      .isIn(['star', 'heart', 'chart', 'rocket', 'fire', 'target', 'crown', 'alien', 'octopus', 'folder', 'bookmark'])
      .withMessage('Invalid icon'),

    handleValidationErrors
  ],

  addSymbol: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid watchlist ID'),

    body('symbol')
      .trim()
      .notEmpty().withMessage('Symbol is required')
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
      .escape(),

    handleValidationErrors
  ],

  removeSymbol: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid watchlist ID'),

    param('symbol')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    handleValidationErrors
  ],

  reorder: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid watchlist ID'),

    body('items')
      .isArray({ min: 1 }).withMessage('Items array is required'),

    body('items.*.symbol')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    body('items.*.position')
      .isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),

    handleValidationErrors
  ]
};

/**
 * Quote validators
 */
export const quoteValidators = {
  getQuote: [
    param('symbol')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    handleValidationErrors
  ],

  getCandles: [
    param('symbol')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    query('from')
      .isInt({ min: 0 }).withMessage('from must be a valid Unix timestamp'),

    query('to')
      .isInt({ min: 0 }).withMessage('to must be a valid Unix timestamp'),

    query('resolution')
      .optional()
      .isIn(['1', '5', '15', '30', '60', 'D', 'W', 'M']).withMessage('Invalid resolution'),

    handleValidationErrors
  ],

  getBatch: [
    query('symbols')
      .notEmpty().withMessage('Symbols are required')
      .custom((value) => {
        const symbols = value.split(',').map(s => s.trim().toUpperCase());
        if (symbols.length > 50) {
          throw new Error('Maximum 50 symbols allowed');
        }
        for (const symbol of symbols) {
          if (!/^[A-Z0-9\.\-]{1,10}$/.test(symbol)) {
            throw new Error(`Invalid symbol format: ${symbol}`);
          }
        }
        return true;
      }),

    handleValidationErrors
  ]
};

/**
 * Search validators
 */
export const searchValidators = {
  search: [
    query('q')
      .trim()
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 1, max: 100 }).withMessage('Query must be 1-100 characters')
      .escape(),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),

    handleValidationErrors
  ]
};

/**
 * Symbol validators (admin operations)
 */
export const symbolValidators = {
  sync: [
    query('exchange')
      .optional()
      .trim()
      .toUpperCase()
      .isLength({ min: 1, max: 10 }).withMessage('Exchange code must be 1-10 characters'),

    query('refresh')
      .optional()
      .isIn(['true', 'false', '1', '0']).withMessage('refresh must be a boolean'),

    handleValidationErrors
  ],

  lookup: [
    param('symbol')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z0-9\.\-]{1,10}$/).withMessage('Invalid stock symbol format'),

    handleValidationErrors
  ]
};

/**
 * API Keys validators (admin operations)
 */
export const apiKeysValidators = {
  addKey: [
    body('serviceName')
      .trim()
      .notEmpty().withMessage('Service name is required')
      .isLength({ min: 1, max: 50 }).withMessage('Service name must be 1-50 characters'),

    body('keyValue')
      .trim()
      .notEmpty().withMessage('API key value is required')
      .isLength({ min: 10, max: 500 }).withMessage('API key must be 10-500 characters'),

    body('keyName')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Key name must be less than 100 characters'),

    handleValidationErrors
  ],

  updateKey: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid key ID'),

    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean'),

    body('priority')
      .optional()
      .isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),

    handleValidationErrors
  ],

  deleteKey: [
    param('id')
      .isInt({ min: 1 }).withMessage('Invalid key ID'),

    handleValidationErrors
  ]
};

export default {
  handleValidationErrors,
  authValidators,
  watchlistValidators,
  quoteValidators,
  searchValidators,
  symbolValidators,
  apiKeysValidators
};
