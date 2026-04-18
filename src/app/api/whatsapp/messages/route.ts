import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';
import { sendWhatsAppText, getWhatsAppConfigForCompany, isConfigured } from '@/lib/whatsapp';

// GET /api/whatsapp/messages?chat_id=XXX@c.us → все сообщения чата (и помечает входящие как прочитанные)
export async function GET(request: NextRequest) {
  try {
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id') || '';
    if (!chatId) return NextResponse.json({ error: 'chat_id required' }, { status: 400 });

    const sql = await getDb();

    const messages = await sql`
      SELECT id, direction, message_type, text, media_url, created_at, is_read
      FROM whatsapp_messages
      WHERE company_id = ${companyId} AND wa_chat_id = ${chatId}
      ORDER BY created_at ASC
    `;

    // Отмечаем входящие как прочитанные
    await sql`
      UPDATE whatsapp_messages
      SET is_read = true
      WHERE company_id = ${companyId} AND wa_chat_id = ${chatId} AND direction = 'in' AND is_read = false
    `;

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error loading WhatsApp messages:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/whatsapp/messages → отправить сообщение в чат
// body: { chat_id: string, text: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = Number((session?.user as { id?: string })?.id) || null;

    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const cfg = await getWhatsAppConfigForCompany(companyId);
    if (!isConfigured(cfg)) {
      return NextResponse.json(
        { error: 'WhatsApp не подключён. Откройте «Настройки WhatsApp» и заполните провайдера.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const chatId = String(body.chat_id || '');
    const text = String(body.text || '').trim();
    if (!chatId || !text) {
      return NextResponse.json({ error: 'chat_id and text required' }, { status: 400 });
    }

    const sql = await getDb();

    // Находим клиента по chat_id
    const clientRow = await sql`
      SELECT id, phone, name FROM clients
      WHERE company_id = ${companyId} AND wa_chat_id = ${chatId}
      LIMIT 1
    `;
    const clientId = clientRow[0] ? Number(clientRow[0].id) : null;
    const phone = clientRow[0] ? String(clientRow[0].phone) : '';
    const name = clientRow[0] ? String(clientRow[0].name) : '';

    // Отправляем через Green API
    const sendRes = await sendWhatsAppText(cfg, chatId, text);
    if (!sendRes.ok) {
      return NextResponse.json({ error: `Не удалось отправить: ${sendRes.error}` }, { status: 502 });
    }

    // Сохраняем как исходящее
    const saved = await sql`
      INSERT INTO whatsapp_messages (
        company_id, client_id, wa_chat_id, wa_phone, wa_profile_name,
        direction, message_type, text, provider, provider_msg_id, is_read, sent_by_user_id
      ) VALUES (
        ${companyId}, ${clientId}, ${chatId}, ${phone}, ${name},
        'out', 'text', ${text}, 'green-api', ${sendRes.messageId || ''}, true, ${userId}
      )
      RETURNING id, direction, message_type, text, created_at, is_read
    `;

    return NextResponse.json(saved[0]);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
