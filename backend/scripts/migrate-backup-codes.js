#!/usr/bin/env node
/**
 * Migration script to hash existing plaintext MFA backup codes
 *
 * This script migrates plaintext backup codes to bcrypt-hashed format.
 * It's safe to run multiple times - already hashed codes are skipped.
 *
 * Prerequisites:
 * - Database must be accessible
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-backup-codes.js
 *
 * Options:
 *   --dry-run    Preview changes without modifying database
 *   --verbose    Show detailed output for each user
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BCRYPT_ROUNDS = 10;

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

console.log('=== Backup Codes Migration Script ===');
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
console.log('');

// Open database
const dbPath = path.join(__dirname, '../database/stocktracker.db');
let db;
try {
  db = new Database(dbPath);
} catch (error) {
  console.error(`ERROR: Could not open database at ${dbPath}`);
  console.error(error.message);
  process.exit(1);
}

// Get all users with MFA backup codes
const users = db.prepare(`
  SELECT id, email, mfa_backup_codes
  FROM users
  WHERE mfa_backup_codes IS NOT NULL AND mfa_backup_codes != ''
`).all();

console.log(`Found ${users.length} user(s) with MFA backup codes`);
console.log('');

let migrated = 0;
let skipped = 0;
let errors = 0;

/**
 * Check if backup codes are already hashed
 * Hashed codes have 'hash' property, plaintext have 'code' property
 */
function isAlreadyHashed(codes) {
  if (!codes || codes.length === 0) return true;
  // Check first unused code
  const unusedCode = codes.find(c => !c.used);
  if (!unusedCode) return true; // All codes used, nothing to migrate
  return !!unusedCode.hash;
}

async function migrateUser(user) {
  const { id, email, mfa_backup_codes } = user;

  try {
    const codes = JSON.parse(mfa_backup_codes);

    // Check if already hashed
    if (isAlreadyHashed(codes)) {
      if (verbose) {
        console.log(`[SKIP] User ${id} (${email}): Already hashed`);
      }
      skipped++;
      return;
    }

    // Hash each unused code
    const hashedCodes = await Promise.all(
      codes.map(async (codeObj) => {
        if (codeObj.used) {
          // Keep used codes as-is (they're spent anyway)
          return {
            hash: 'USED',
            used: true,
            usedAt: codeObj.usedAt,
          };
        }

        // Hash the plaintext code
        const plainCode = codeObj.code.replace(/-/g, '');
        return {
          hash: await bcrypt.hash(plainCode, BCRYPT_ROUNDS),
          used: false,
          usedAt: null,
        };
      })
    );

    if (dryRun) {
      console.log(`[WOULD MIGRATE] User ${id} (${email})`);
      if (verbose) {
        const unusedCount = codes.filter(c => !c.used).length;
        console.log(`  ${unusedCount} unused codes to hash`);
      }
    } else {
      // Update the database
      db.prepare('UPDATE users SET mfa_backup_codes = ? WHERE id = ?')
        .run(JSON.stringify(hashedCodes), id);
      console.log(`[MIGRATED] User ${id} (${email})`);
    }
    migrated++;
  } catch (error) {
    console.error(`[ERROR] User ${id} (${email}): ${error.message}`);
    errors++;
  }
}

async function main() {
  for (const user of users) {
    await migrateUser(user);
  }

  // Close database
  db.close();

  // Summary
  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Total users with backup codes: ${users.length}`);
  console.log(`Already hashed:                ${skipped}`);
  console.log(`${dryRun ? 'Would migrate' : 'Migrated'}:                ${migrated}`);
  console.log(`Errors:                        ${errors}`);

  if (dryRun && migrated > 0) {
    console.log('');
    console.log('Run without --dry-run to apply these changes.');
  }

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
