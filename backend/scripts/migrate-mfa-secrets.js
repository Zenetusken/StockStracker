#!/usr/bin/env node
/**
 * Migration script to encrypt existing MFA secrets at rest
 *
 * This script migrates plaintext MFA secrets to encrypted format.
 * It's safe to run multiple times - already encrypted secrets are skipped.
 *
 * Prerequisites:
 * - DB_ENCRYPTION_KEY environment variable must be set (64-char hex string)
 * - Database must be accessible
 *
 * Usage:
 *   cd backend
 *   DB_ENCRYPTION_KEY=your-64-char-hex-key node scripts/migrate-mfa-secrets.js
 *
 * Options:
 *   --dry-run    Preview changes without modifying database
 *   --verbose    Show detailed output for each user
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { encrypt, isEncrypted, isEncryptionEnabled } from '../src/utils/encryption.js';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

console.log('=== MFA Secret Migration Script ===');
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
console.log('');

// Check encryption key
if (!isEncryptionEnabled()) {
  console.error('ERROR: DB_ENCRYPTION_KEY is not set or invalid.');
  console.error('Please set the DB_ENCRYPTION_KEY environment variable to a 64-character hex string.');
  console.error('');
  console.error('Generate a key with:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Open database
const dbPath = path.join(__dirname, '../stocktracker.db');
let db;
try {
  db = new Database(dbPath);
} catch (error) {
  console.error(`ERROR: Could not open database at ${dbPath}`);
  console.error(error.message);
  process.exit(1);
}

// Get all users with MFA secrets
const users = db.prepare(`
  SELECT id, email, mfa_secret
  FROM users
  WHERE mfa_secret IS NOT NULL AND mfa_secret != ''
`).all();

console.log(`Found ${users.length} user(s) with MFA secrets`);
console.log('');

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const user of users) {
  const { id, email, mfa_secret } = user;

  // Check if already encrypted
  if (isEncrypted(mfa_secret)) {
    if (verbose) {
      console.log(`[SKIP] User ${id} (${email}): Already encrypted`);
    }
    skipped++;
    continue;
  }

  try {
    // Encrypt the secret
    const encryptedSecret = encrypt(mfa_secret);

    if (dryRun) {
      console.log(`[WOULD MIGRATE] User ${id} (${email})`);
      if (verbose) {
        console.log(`  Plaintext length: ${mfa_secret.length}`);
        console.log(`  Encrypted length: ${encryptedSecret.length}`);
      }
    } else {
      // Update the database
      db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?')
        .run(encryptedSecret, id);
      console.log(`[MIGRATED] User ${id} (${email})`);
    }
    migrated++;
  } catch (error) {
    console.error(`[ERROR] User ${id} (${email}): ${error.message}`);
    errors++;
  }
}

// Close database
db.close();

// Summary
console.log('');
console.log('=== Migration Summary ===');
console.log(`Total users with MFA: ${users.length}`);
console.log(`Already encrypted:    ${skipped}`);
console.log(`${dryRun ? 'Would migrate' : 'Migrated'}:         ${migrated}`);
console.log(`Errors:               ${errors}`);

if (dryRun && migrated > 0) {
  console.log('');
  console.log('Run without --dry-run to apply these changes.');
}

if (errors > 0) {
  process.exit(1);
}
