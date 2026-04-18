import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    if (clientId) {
      const rows = await sql`
        SELECT v.*, c.name as client_name
        FROM client_visits v
        LEFT JOIN clients c ON c.id = v.client_id
        WHERE v.company_id = ${companyId} AND v.client_id = ${Number(clientId)}
        ORDER BY v.visited_at DESC
      `;
      return NextResponse.json(rows);
    }

    const rows = await sql`
      SELECT v.*, c.name as client_name, c.phone as client_phone
      FROM client_visits v
      LEFT JOIN clients c ON c.id = v.client_id
      WHERE v.company_id = ${companyId}
      ORDER BY v.visited_at DESC
      LIMIT 200
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching visits:', error);
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const session = await getServerSession(authOptions);
    const userId = Number((session?.user as { id?: string })?.id) || null;
    const userName = session?.user?.name || '';

    const body = await request.json();
    const { client_id, visited_at, channel, notes } = body;
    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const when = visited_at ? new Date(visited_at) : new Date();

    const result = await sql`
      INSERT INTO client_visits (company_id, client_id, visited_at, channel, notes, created_by, created_by_name)
      VALUES (${companyId}, ${Number(client_id)}, ${when.toISOString()}, ${channel || 'office'}, ${notes || ''}, ${userId}, ${userName})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await sql`DELETE FROM client_visits WHERE id = ${id} AND company_id = ${companyId}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting visit:', error);
    return NextResponse.json({ error: 'Failed to delete visit' }, { status: 500 });
  }
}
