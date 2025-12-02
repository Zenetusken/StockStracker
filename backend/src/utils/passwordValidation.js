import zxcvbn from 'zxcvbn';

/**
 * Password Validation Utility
 *
 * Uses zxcvbn for realistic password strength estimation.
 * zxcvbn analyzes passwords for common patterns, dictionary words,
 * sequences, and provides accurate crack time estimates.
 */

// Minimum password requirements
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;
const MIN_STRENGTH_SCORE = 3; // zxcvbn scores: 0-4 (3+ is "reasonably unguessable")

/**
 * Validate password strength
 *
 * @param {string} password - The password to validate
 * @param {string[]} userInputs - User-specific words to penalize (email, name, etc.)
 * @returns {Object} Validation result with valid flag, errors, score, and feedback
 */
export function validatePassword(password, userInputs = []) {
  const errors = [];
  const warnings = [];

  // Basic length checks
  if (!password) {
    return {
      valid: false,
      errors: ['Password is required'],
      warnings: [],
      score: 0,
      crackTime: 'instant',
      feedback: null
    };
  }

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long`);
  }

  if (password.length > MAX_LENGTH) {
    errors.push(`Password must be less than ${MAX_LENGTH} characters`);
  }

  // Run zxcvbn analysis
  // Pass user inputs to penalize passwords containing user info
  const result = zxcvbn(password, userInputs);

  // Check strength score
  if (result.score < MIN_STRENGTH_SCORE) {
    errors.push('Password is too weak');

    // Add zxcvbn's specific feedback
    if (result.feedback.warning) {
      warnings.push(result.feedback.warning);
    }

    if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
      warnings.push(...result.feedback.suggestions);
    }
  }

  // Check for common patterns that zxcvbn might miss
  const commonPatterns = [
    { pattern: /^(.)\1+$/, message: 'Password cannot be all the same character' },
    { pattern: /^(012|123|234|345|456|567|678|789|890)+$/, message: 'Password cannot be a numeric sequence' },
    { pattern: /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, message: 'Password cannot be an alphabetic sequence' },
  ];

  for (const { pattern, message } of commonPatterns) {
    if (pattern.test(password)) {
      if (!errors.includes(message)) {
        errors.push(message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: result.score,
    crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    feedback: result.feedback
  };
}

/**
 * Get password strength label
 *
 * @param {number} score - zxcvbn score (0-4)
 * @returns {string} Human-readable strength label
 */
export function getStrengthLabel(score) {
  const labels = [
    'Very Weak',   // 0
    'Weak',        // 1
    'Fair',        // 2
    'Strong',      // 3
    'Very Strong'  // 4
  ];
  return labels[score] || 'Unknown';
}

/**
 * Check if password meets minimum requirements without full validation
 * Useful for real-time feedback during typing
 *
 * @param {string} password - The password to check
 * @returns {Object} Quick check result
 */
export function quickCheck(password) {
  if (!password) {
    return {
      meetsLength: false,
      estimatedStrength: 0,
      lengthProgress: 0
    };
  }

  const meetsLength = password.length >= MIN_LENGTH;
  const result = zxcvbn(password);

  return {
    meetsLength,
    estimatedStrength: result.score,
    strengthLabel: getStrengthLabel(result.score),
    lengthProgress: Math.min(100, (password.length / MIN_LENGTH) * 100),
    crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second
  };
}

export default {
  validatePassword,
  getStrengthLabel,
  quickCheck,
  MIN_LENGTH,
  MAX_LENGTH,
  MIN_STRENGTH_SCORE
};
