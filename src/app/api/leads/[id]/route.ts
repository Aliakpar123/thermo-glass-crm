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
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = ${Number(id)}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
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
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const { name, phone, source, message, status, assigned_to } = body;

    const existing = await sql`SELECT * FROM leads WHERE id = ${Number(id)}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const ex = existing[0] as Record<string, unknown>;

    await sql`
      UPDATE leads
      SET name = ${name ?? ex.name},
          phone = ${phone ?? ex.phone},
          source = ${source ?? ex.source},
          message = ${message ?? ex.message},
          status = ${status ?? ex.status},
          assigned_to = ${assigned_to !== undefined ? assigned_to : ex.assigned_to},
          updated_at = NOW()
      WHERE id = ${Number(id)}
    `;

    const updated = await sql`SELECT * FROM leads WHERE id = ${Number(id)}`;
    return NextResponse.json(updated[0]);
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
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();

    if (body.action !== 'convert') {
      return NextResponse.json({ error: 'Invalid action. Use action=convert' }, { status: 400 });
    }

    const leadRows = await sql`SELECT * FROM leads WHERE id = ${Number(id)}`;
    if (leadRows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const lead = leadRows[0] as Record<string, unknown>;

    if (lead.status === 'converted') {
      return NextResponse.json({ error: 'Lead is already converted' }, { status: 400 });
    }

    // Create client from lead data
    const clientResult = await sql`
      INSERT INTO clients (name, phone, source, notes, assigned_manager_id)
      VALUES (${lead.name}, ${lead.phone}, ${lead.source}, ${lead.message || ''}, ${lead.assigned_to || body.assigned_manager_id || null})
      RETURNING *
    `;

    // Mark lead as converted
    await sql`
      UPDATE leads SET status = 'converted', updated_at = NOW() WHERE id = ${Number(id)}
    `;

    return NextResponse.json({
      message: 'Lead converted to client',
      client: clientResult[0],
    }, { status: 201 });
  } catch (error) {
    console.error('Error converting lead:', error);
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
