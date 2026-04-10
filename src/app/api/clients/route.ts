import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const managerId = searchParams.get('manager_id') || '';

    const clients = await sql`
      SELECT c.*, u.name as manager_name,
        CASE WHEN EXISTS(SELECT 1 FROM leads WHERE client_id = c.id) THEN 'transferred' ELSE 'active' END as status
      FROM clients c
      LEFT JOIN users u ON c.assigned_manager_id = u.id
      WHERE (${search} = '' OR c.name ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'} OR c.city ILIKE ${'%' + search + '%'})
        AND (${source} = '' OR c.source = ${source})
        AND (${managerId} = '' OR c.assigned_manager_id = ${managerId === '' ? 0 : Number(managerId)})
      ORDER BY c.created_at DESC
    `;

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { name, phone, email, city, address, source, notes, assigned_manager_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO clients (name, phone, email, city, address, source, notes, assigned_manager_id)
      VALUES (${name}, ${phone}, ${email || ''}, ${city || ''}, ${address || ''}, ${source || 'other'}, ${notes || ''}, ${assigned_manager_id || null})
      RETURNING *
    `;

    await sql`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (${assigned_manager_id || null}, '', 'Добавил клиента', 'client', ${result[0].id}, ${name})`;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
