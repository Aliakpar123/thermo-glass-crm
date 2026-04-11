import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { order_id, client_id, pain_category, pain_text, city, room_type, source } = body;

    if (!pain_category) {
      return NextResponse.json({ error: 'pain_category is required' }, { status: 400 });
    }

    await sql`
      INSERT INTO pain_points (order_id, client_id, pain_category, pain_text, city, room_type, source)
      VALUES (${order_id || null}, ${client_id || null}, ${pain_category}, ${pain_text || ''}, ${city || ''}, ${room_type || ''}, ${source || ''})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error saving pain point:', error);
    return NextResponse.json({ error: 'Failed to save pain point' }, { status: 500 });
  }
}
