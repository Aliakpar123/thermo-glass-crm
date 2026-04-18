import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

// GET /api/whatsapp/chats → список диалогов (последнее сообщение на чат + непрочитанные)
export async function GET() {
  try {
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const sql = await getDb();
    const rows = await sql`
      WITH latest AS (
        SELECT DISTINCT ON (wa_chat_id)
          wa_chat_id, wa_phone, wa_profile_name, client_id, text, direction, created_at
        FROM whatsapp_messages
        WHERE company_id = ${companyId}
        ORDER BY wa_chat_id, created_at DESC
      ),
      unread AS (
        SELECT wa_chat_id, COUNT(*)::int AS unread_count
        FROM whatsapp_messages
        WHERE company_id = ${companyId} AND direction = 'in' AND is_read = false
        GROUP BY wa_chat_id
      )
      SELECT
        l.wa_chat_id, l.wa_phone, l.wa_profile_name, l.client_id,
        l.text AS last_message, l.direction AS last_direction, l.created_at AS last_at,
        COALESCE(u.unread_count, 0) AS unread_count,
        c.name AS client_name
      FROM latest l
      LEFT JOIN unread u ON u.wa_chat_id = l.wa_chat_id
      LEFT JOIN clients c ON c.id = l.client_id
      ORDER BY l.created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error listing WhatsApp chats:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
