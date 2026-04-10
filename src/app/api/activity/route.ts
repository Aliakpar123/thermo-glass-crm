import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const sql = await getDb();
    const rows = await sql`
      SELECT * FROM activity_log
      ORDER BY created_at DESC
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
