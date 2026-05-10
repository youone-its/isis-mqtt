const Database = require('better-sqlite3');
const db = new Database('./farming.db');

db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    allowed_controllers TEXT
)`);

const count = db.prepare('SELECT count(*) as count FROM users').get();
if (count.count === 0) {
    const stmt = db.prepare('INSERT INTO users (username, password, allowed_controllers) VALUES (?, ?, ?)');
    stmt.run('admin', '123', 'YBA_01,YBA_02,KCD_01,NRP_01');
    stmt.run('petani1', '123', 'KCD_01,KCD_02');
}

module.exports = db;
