import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const userId = request.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const mentions = await sql`
      SELECT * FROM mention_notifications
      WHERE user_id = ${Number(userId)} AND is_read = false
      ORDER BY created_at DESC
    `;
    return NextResponse.json(mentions);
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return NextResponse.json({ error: 'Failed to fetch mentions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    await sql`UPDATE mention_notifications SET is_read = true WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating mention:', error);
    return NextResponse.json({ error: 'Failed to update mention' }, { status: 500 });
  }
}
