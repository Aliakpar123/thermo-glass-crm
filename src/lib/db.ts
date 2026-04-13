import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set');
}

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

const DB_VERSION = 'v5_evgeniy'; // bump to force re-init
let initializedVersion = '';

async function initDb() {
  if (!sql || initializedVersion === DB_VERSION) return;
  initializedVersion = DB_VERSION;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT DEFAULT '',
        city TEXT DEFAULT '',
        address TEXT DEFAULT '',
        source TEXT NOT NULL DEFAULT 'other',
        notes TEXT DEFAULT '',
        assigned_manager_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        source TEXT DEFAULT 'other',
        message TEXT DEFAULT '',
        status TEXT DEFAULT 'new',
        assigned_to INTEGER,
        client_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL,
        manager_id INTEGER NOT NULL,
        lead_id INTEGER,
        product_type TEXT DEFAULT 'steklopaket',
        description TEXT DEFAULT '',
        dimensions TEXT DEFAULT '',
        quantity INTEGER DEFAULT 1,
        amount NUMERIC DEFAULT 0,
        prepayment NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'new',
        factory_order_number TEXT DEFAULT '',
        object_city TEXT DEFAULT '',
        items_json TEXT DEFAULT '[]',
        heating_type TEXT DEFAULT '',
        required_power INTEGER DEFAULT 0,
        multifunctional_glass TEXT DEFAULT '',
        glass_color TEXT DEFAULT '',
        room_type TEXT DEFAULT '',
        room_area NUMERIC DEFAULT 0,
        total_area NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS order_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        changed_by INTEGER NOT NULL,
        comment TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name TEXT DEFAULT '',
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS client_comments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL,
        user_id INTEGER,
        user_name TEXT DEFAULT '',
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Migrations - add columns if they don't exist
    try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_reason TEXT DEFAULT ''`; } catch(e) { /* column may already exist */ }
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS loss_reason TEXT DEFAULT ''`; } catch(e) { /* column may already exist */ }
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMP`; } catch(e) {}
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS next_action_text TEXT DEFAULT ''`; } catch(e) {}

    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_pain TEXT DEFAULT ''`; } catch(e) {}

    try { await sql`CREATE TABLE IF NOT EXISTS pain_points (
      id SERIAL PRIMARY KEY,
      order_id INTEGER,
      client_id INTEGER,
      pain_category TEXT NOT NULL,
      pain_text TEXT DEFAULT '',
      city TEXT DEFAULT '',
      room_type TEXT DEFAULT '',
      source TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`; } catch(e) {}

    try {
      await sql`CREATE TABLE IF NOT EXISTS deal_files (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT DEFAULT '',
        uploaded_by INTEGER,
        uploaded_by_name TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )`;
    } catch(e) {}

    try { await sql`CREATE TABLE IF NOT EXISTS deal_messages (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      client_id INTEGER,
      sender TEXT NOT NULL DEFAULT 'manager',
      sender_name TEXT DEFAULT '',
      message TEXT NOT NULL,
      is_parsed BOOLEAN DEFAULT false,
      parsed_pains TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`; } catch(e) {}

    try { await sql`CREATE TABLE IF NOT EXISTS mention_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      from_user_name TEXT DEFAULT '',
      deal_id INTEGER,
      client_id INTEGER,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`; } catch(e) {}

    // Seed users if empty
    const result = await sql`SELECT COUNT(*) as count FROM users`;
    if (Number(result[0].count) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const mgrHash = bcrypt.hashSync('manager123', 10);
      await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Администратор', 'admin@thermoglass.kz', ${adminHash}, 'admin')`;
      await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Камилла', 'kamilla@thermoglass.kz', ${mgrHash}, 'client_manager')`;
      await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Айжан', 'aizhan@thermoglass.kz', ${mgrHash}, 'order_manager')`;
      await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Евгений', 'evgeniy@thermoglass.kz', ${mgrHash}, 'delivery_manager')`;
    }
    // Migration: add Евгений if not exists
    const evgeniy = await sql`SELECT id FROM users WHERE email = 'evgeniy@thermoglass.kz'`;
    if (evgeniy.length === 0) {
      const mgrHash2 = bcrypt.hashSync('manager123', 10);
      await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Евгений', 'evgeniy@thermoglass.kz', ${mgrHash2}, 'delivery_manager')`;
    }
  } catch (e) {
    console.error('DB init error:', e);
    initializedVersion = '';
  }
}

export async function getDb() {
  if (!sql) throw new Error('DATABASE_URL not configured');
  await initDb();
  return sql;
}

export default getDb;
