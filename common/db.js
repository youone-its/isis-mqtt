const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./farming.db');

db.serialize(() => {
    // Tabel User
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        allowed_controllers TEXT -- Disimpan sebagai string dipisah koma, misal: 'YBA_01,YBA_02'
    )`);

    // Tambah data awal jika kosong
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO users (username, password, allowed_controllers) VALUES ('admin', '123', 'YBA_01,YBA_02,KCD_01,NRP_01')");
            db.run("INSERT INTO users (username, password, allowed_controllers) VALUES ('petani1', '123', 'KCD_01,KCD_02')");
        }
    });
});

module.exports = db;