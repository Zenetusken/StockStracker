const Database = require('./backend/node_modules/better-sqlite3');
const bcrypt = require('./backend/node_modules/bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'stocktracker.db');
const db = new Database(dbPath);

// Check existing users
console.log('Existing users:');
const users = db.prepare('SELECT id, email FROM users').all();
console.log(users);

// Create a test user if none exists
if (users.length === 0) {
  console.log('\nCreating test user...');
  const email = 'test@example.com';
  const password = 'password123';
  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hashedPassword);
  const userId = result.lastInsertRowid;
  console.log(`User created with ID: ${userId}`);

  // Create default watchlist
  const watchlistResult = db.prepare(
    'INSERT INTO watchlists (user_id, name, color, icon, is_default) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, 'My Watchlist', 'blue', 'star', 1);
  console.log(`Default watchlist created with ID: ${watchlistResult.lastInsertRowid}`);

  console.log('\nTest user credentials:');
  console.log('Email: test@example.com');
  console.log('Password: password123');
} else {
  console.log('\nUsers already exist. First user email:', users[0].email);
  console.log('Use password: password123 (if created by this script)');
}

db.close();
