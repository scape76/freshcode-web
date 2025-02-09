import {db} from './db';

db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const seedAdmin = db.prepare("SELECT * FROM admins WHERE username = ?");

if (!seedAdmin.get(process.env.ADMIN_LOGIN!)) {
    const insertAdmin = db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)");

    insertAdmin.run(process.env.ADMIN_LOGIN!, process.env.ADMIN_PASSWORD!);
}