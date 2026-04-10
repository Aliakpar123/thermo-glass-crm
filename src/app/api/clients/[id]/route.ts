import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const rows = await sql`
      SELECT c.*, u.name as manager_name
      FROM clients c
      LEFT JOIN users u ON c.assigned_manager_id = u.id
      WHERE c.id = ${Number(id)}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, city, address, source, notes, assigned_manager_id } = body;

    const existing = await sql`SELECT * FROM clients WHERE id = ${Number(id)}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const ex = existing[0] as Record<string, unknown>;

    await sql`
      UPDATE clients
      SET name = ${name ?? ex.name},
          phone = ${phone ?? ex.phone},
          email = ${email ?? ex.email},
          city = ${city ?? ex.city},
          address = ${address ?? ex.address},
          source = ${source ?? ex.source},
          notes = ${notes ?? ex.notes},
          assigned_manager_id = ${assigned_manager_id !== undefined ? assigned_manager_id : ex.assigned_manager_id},
          updated_at = NOW()
      WHERE id = ${Number(id)}
    `;

    const updated = await sql`SELECT * FROM clients WHERE id = ${Number(id)}`;
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const existing = await sql`SELECT * FROM clients WHERE id = ${Number(id)}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await sql`DELETE FROM clients WHERE id = ${Number(id)}`;
    return NextResponse.json({ message: 'Client deleted' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
