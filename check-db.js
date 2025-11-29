import Database from 'better-sqlite3';

const db = new Database('./backend/database/stocktracker.db');

console.log('Checking database...\n');

// Get last user
const lastUser = db.prepare('SELECT id, email FROM users ORDER BY id DESC LIMIT 1').get();
if (lastUser) {
  console.log(`Last registered user: ${lastUser.email} (ID: ${lastUser.id})`);

  // Check watchlists for this user
  const watchlists = db.prepare('SELECT * FROM watchlists WHERE user_id = ?').all(lastUser.id);
  console.log(`\nWatchlists for this user: ${watchlists.length}`);

  if (watchlists.length > 0) {
    watchlists.forEach(w => {
      console.log(`  - ${w.name} (ID: ${w.id}, is_default: ${w.is_default})`);
    });
  } else {
    console.log('  No watchlists found!');
  }
} else {
  console.log('No users found in database');
}

db.close();
