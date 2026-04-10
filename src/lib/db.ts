import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';

// On Vercel, use /tmp for writable storage. Locally use ./db/
const isVercel = process.env.VERCEL === '1';
const DB_DIR = isVercel ? '/tmp' : path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'crm.db');
const SEED_PATH = path.join(process.cwd(), 'db', 'seed.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    // On Vercel: copy seed DB to /tmp if not exists yet
    if (isVercel && !fs.existsSync(DB_PATH) && fs.existsSync(SEED_PATH)) {
      fs.copyFileSync(SEED_PATH, DB_PATH);
    }
    if (!isVercel && !fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb(db);
  }
  return db;
}

function initDb(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'order_manager', 'client_manager')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      city TEXT DEFAULT '',
      address TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('whatsapp', 'instagram', 'website', 'phone', 'referral', 'other')),
      notes TEXT DEFAULT '',
      assigned_manager_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      manager_id INTEGER NOT NULL REFERENCES users(id),
      lead_id INTEGER,
      product_type TEXT NOT NULL DEFAULT 'steklopaket',
      description TEXT DEFAULT '',
      dimensions TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      amount REAL DEFAULT 0,
      prepayment REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'calculation', 'approved', 'factory', 'production', 'delivery', 'installation', 'completed', 'cancelled')),
      factory_order_number TEXT DEFAULT '',
      object_city TEXT DEFAULT '',
      items_json TEXT DEFAULT '[]',
      heating_type TEXT DEFAULT '',
      required_power INTEGER DEFAULT 0,
      multifunctional_glass TEXT DEFAULT 'нет',
      glass_color TEXT DEFAULT 'прозрачная',
      room_type TEXT DEFAULT '',
      room_area REAL DEFAULT 0,
      total_area REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      status TEXT NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('whatsapp', 'instagram', 'website', 'phone', 'referral', 'other')),
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'converted', 'lost')),
      assigned_to INTEGER REFERENCES users(id),
      client_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Администратор', 'admin@thermoglass.kz', hash, 'admin');

    const hash2 = bcrypt.hashSync('manager123', 10);
    database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Камилла', 'kamilla@thermoglass.kz', hash2, 'client_manager');
    database.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Айжан', 'aizhan@thermoglass.kz', hash2, 'order_manager');
  }
}

export default getDb;
