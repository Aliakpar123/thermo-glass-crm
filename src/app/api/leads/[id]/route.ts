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
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = ?
    `).get(Number(id));

    if (!row) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
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
    const { name, phone, source, message, status, assigned_to } = body;

    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE leads
      SET name = ?,
          phone = ?,
          source = ?,
          message = ?,
          status = ?,
          assigned_to = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? existing.name,
      phone ?? existing.phone,
      source ?? existing.source,
      message ?? existing.message,
      status ?? existing.status,
      assigned_to !== undefined ? assigned_to : existing.assigned_to,
      Number(id)
    );

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    if (body.action !== 'convert') {
      return NextResponse.json({ error: 'Invalid action. Use action=convert' }, { status: 400 });
    }

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status === 'converted') {
      return NextResponse.json({ error: 'Lead is already converted' }, { status: 400 });
    }

    // Create client from lead data
    const clientResult = db.prepare(`
      INSERT INTO clients (name, phone, source, notes, assigned_manager_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(lead.name, lead.phone, lead.source, lead.message || '', lead.assigned_to || body.assigned_manager_id || null);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientResult.lastInsertRowid);

    // Mark lead as converted
    db.prepare("UPDATE leads SET status = 'converted', updated_at = datetime('now') WHERE id = ?").run(Number(id));

    return NextResponse.json({
      message: 'Lead converted to client',
      client,
    }, { status: 201 });
  } catch (error) {
    console.error('Error converting lead:', error);
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
