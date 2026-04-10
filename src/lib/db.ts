import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

let initialized = false;

export async function getDb() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return sql;
}

async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'order_manager', 'client_manager')),
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
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('whatsapp', 'instagram', 'website', 'phone', 'referral', 'other')),
      notes TEXT DEFAULT '',
      assigned_manager_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('whatsapp', 'instagram', 'website', 'phone', 'referral', 'other')),
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'converted', 'lost')),
      assigned_to INTEGER REFERENCES users(id),
      client_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      manager_id INTEGER NOT NULL REFERENCES users(id),
      lead_id INTEGER,
      product_type TEXT NOT NULL DEFAULT 'steklopaket',
      description TEXT DEFAULT '',
      dimensions TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      amount NUMERIC DEFAULT 0,
      prepayment NUMERIC DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'calculation', 'approved', 'factory', 'production', 'delivery', 'installation', 'completed', 'cancelled')),
      factory_order_number TEXT DEFAULT '',
      object_city TEXT DEFAULT '',
      items_json TEXT DEFAULT '[]',
      heating_type TEXT DEFAULT '',
      required_power INTEGER DEFAULT 0,
      multifunctional_glass TEXT DEFAULT 'нет',
      glass_color TEXT DEFAULT 'прозрачная',
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
      order_id INTEGER NOT NULL REFERENCES orders(id),
      status TEXT NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      comment TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Seed default users if none exist
  const result = await sql`SELECT COUNT(*) as count FROM users`;
  if (Number(result[0].count) === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);

    await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Администратор', 'admin@thermoglass.kz', ${adminHash}, 'admin')`;
    await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Камилла', 'kamilla@thermoglass.kz', ${managerHash}, 'client_manager')`;
    await sql`INSERT INTO users (name, email, password_hash, role) VALUES ('Айжан', 'aizhan@thermoglass.kz', ${managerHash}, 'order_manager')`;
  }
}

export default getDb;
