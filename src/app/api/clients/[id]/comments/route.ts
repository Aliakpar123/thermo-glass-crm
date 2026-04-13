import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const clientId = Number(id);

    const rows = await sql`
      SELECT * FROM client_comments
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const clientId = Number(id);
    const body = await request.json();
    const { user_id, user_name, text } = body;

    const rows = await sql`
      INSERT INTO client_comments (client_id, user_id, user_name, text)
      VALUES (${clientId}, ${user_id || null}, ${user_name || ''}, ${text})
      RETURNING *
    `;

    await sql`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (${user_id || null}, ${user_name || ''}, 'Добавил комментарий', 'client', ${Number(id)}, ${text.substring(0, 100)})`;

    // Detect @mentions in comment text
    const mentionRegex = /@(\S+)/g;
    const mentions = [...text.matchAll(mentionRegex)].map((m: RegExpMatchArray) => m[1]);

    if (mentions.length > 0) {
      for (const mentionName of mentions) {
        const users = await sql`SELECT id, name FROM users WHERE LOWER(name) LIKE ${('%' + mentionName.toLowerCase() + '%')}`;
        for (const u of users) {
          await sql`
            INSERT INTO mention_notifications (user_id, from_user_name, deal_id, client_id, message)
            VALUES (${u.id}, ${user_name || ''}, ${null}, ${Number(id)}, ${text.substring(0, 200)})
          `;
        }
      }
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
