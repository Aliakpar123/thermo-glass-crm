import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const sql = await getDb();

    // Check if exists
    const existing = await sql`SELECT id FROM users WHERE email = 'evgeniy@thermoglass.kz'`;
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Евгений already exists', id: existing[0].id });
    }

    // Create
    const hash = bcrypt.hashSync('manager123', 10);
    const result = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Евгений', 'evgeniy@thermoglass.kz', ${hash}, 'delivery_manager')
      RETURNING id
    `;

    return NextResponse.json({ message: 'Евгений created!', id: result[0].id });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
