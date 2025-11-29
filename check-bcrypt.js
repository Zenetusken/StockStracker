import Database from 'better-sqlite3';

const db = new Database('./backend/database/stocktracker.db');
const user = db.prepare('SELECT id, email, password_hash FROM users WHERE id = 1').get();

console.log('\n🔐 Bcrypt Hash Verification');
console.log('═══════════════════════════════════════════');
console.log('User:', user.email);
console.log('Password hash:', user.password_hash);
console.log('\nHash format checks:');
console.log('  Starts with $2b$:', user.password_hash.startsWith('$2b$') ? '✅' : '❌');

const rounds = parseInt(user.password_hash.split('$')[2]);
console.log('  Bcrypt rounds:', rounds);
console.log('  Rounds >= 10:', rounds >= 10 ? '✅' : '❌');
console.log('═══════════════════════════════════════════\n');

db.close();
