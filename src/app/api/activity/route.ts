import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    // Only show activity of users who are members of the active company
    const rows = await sql`
      SELECT al.*
      FROM activity_log al
      JOIN user_companies uc ON uc.user_id = al.user_id AND uc.company_id = ${companyId}
      ORDER BY al.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { user_id, user_name, action, entity_type, entity_id, details } = body;

    const rows = await sql`
      INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details)
      VALUES (${user_id || null}, ${user_name || ''}, ${action}, ${entity_type}, ${entity_id || null}, ${details || ''})
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error creating activity log entry:', error);
    return NextResponse.json({ error: 'Failed to create activity log entry' }, { status: 500 });
  }
}
