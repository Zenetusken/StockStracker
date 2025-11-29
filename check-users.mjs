import Database from 'better-sqlite3';

const db = new Database('/home/drei/my_project/builder/claude-quickstarts/autonomous-coding/generations/autonomous_demo_project/backend/database.db');

const users = db.prepare('SELECT id, email FROM users LIMIT 10').all();

console.log('Existing users:');
users.forEach(user => {
  console.log(`  - ${user.email} (ID: ${user.id})`);
});

db.close();
