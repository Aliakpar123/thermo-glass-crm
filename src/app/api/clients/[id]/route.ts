import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = db.prepare(`
      SELECT c.*, u.name as manager_name
      FROM clients c
      LEFT JOIN users u ON c.assigned_manager_id = u.id
      WHERE c.id = ?
    `).get(Number(id));

    if (!row) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(row);
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
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, city, address, source, notes, assigned_manager_id } = body;

    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE clients
      SET name = ?,
          phone = ?,
          email = ?,
          city = ?,
          address = ?,
          source = ?,
          notes = ?,
          assigned_manager_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? existing.name,
      phone ?? existing.phone,
      email ?? existing.email,
      city ?? existing.city,
      address ?? existing.address,
      source ?? existing.source,
      notes ?? existing.notes,
      assigned_manager_id !== undefined ? assigned_manager_id : existing.assigned_manager_id,
      Number(id)
    );

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
    return NextResponse.json(updated);
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
    const db = getDb();
    const { id } = await params;

    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(Number(id));
    return NextResponse.json({ message: 'Client deleted' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
