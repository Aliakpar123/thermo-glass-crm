import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const managerId = searchParams.get('manager_id') || '';

    let query = `
      SELECT c.*, u.name as manager_name
      FROM clients c
      LEFT JOIN users u ON c.assigned_manager_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.city LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (source) {
      query += ` AND c.source = ?`;
      params.push(source);
    }
    if (managerId) {
      query += ` AND c.assigned_manager_id = ?`;
      params.push(Number(managerId));
    }

    query += ` ORDER BY c.created_at DESC`;

    const clients = db.prepare(query).all(...params);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, phone, email, city, address, source, notes, assigned_manager_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO clients (name, phone, email, city, address, source, notes, assigned_manager_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone, email || '', city || '', address || '', source || 'other', notes || '', assigned_manager_id || null);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
