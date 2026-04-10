import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const assignedTo = searchParams.get('assigned_to') || '';
    const search = searchParams.get('search') || '';

    let query = `
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
      query += ` AND l.status = ?`;
      params.push(status);
    }
    if (source) {
      query += ` AND l.source = ?`;
      params.push(source);
    }
    if (assignedTo) {
      query += ` AND l.assigned_to = ?`;
      params.push(Number(assignedTo));
    }
    if (search) {
      query += ` AND (l.name LIKE ? OR l.phone LIKE ? OR l.message LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ` ORDER BY l.created_at DESC`;

    const leads = db.prepare(query).all(...params);
    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, phone, source, message, status, assigned_to, client_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO leads (name, phone, source, message, status, assigned_to, client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone, source || 'other', message || '', status || 'new', assigned_to || null, client_id || null);

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
