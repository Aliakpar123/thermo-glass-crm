import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const assignedTo = searchParams.get('assigned_to') || '';
    const search = searchParams.get('search') || '';

    const leads = await sql`
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE (${status} = '' OR l.status = ${status})
        AND (${source} = '' OR l.source = ${source})
        AND (${assignedTo} = '' OR l.assigned_to = ${assignedTo === '' ? 0 : Number(assignedTo)})
        AND (${search} = '' OR l.name ILIKE ${'%' + search + '%'} OR l.phone ILIKE ${'%' + search + '%'} OR l.message ILIKE ${'%' + search + '%'})
      ORDER BY l.created_at DESC
    `;

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { name, phone, source, message, status, assigned_to, client_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO leads (name, phone, source, message, status, assigned_to, client_id)
      VALUES (${name}, ${phone}, ${source || 'other'}, ${message || ''}, ${status || 'new'}, ${assigned_to || null}, ${client_id || null})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
