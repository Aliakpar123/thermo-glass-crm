import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { findCompanyByWebhookToken } from '@/lib/whatsapp';

// Webhook от Omnichat. Универсальный формат для WhatsApp/Instagram:
// POST /api/webhooks/omnichat?token=<webhookToken>
// {
//   "channel": "whatsapp" | "instagram",
//   "direction": "in",
//   "from": { "phone": "+77011234567", "name": "Иван", "id": "77011234567@c.us" },
//   "text": "Привет",
//   "message_id": "omnichat-123",
//   "media_url": "https://...",    // опционально
//   "timestamp": 1730000000         // unix seconds, опционально
// }

interface OmnichatWebhookBody {
  channel?: 'whatsapp' | 'instagram';
  direction?: 'in' | 'out';
  from?: { phone?: string; name?: string; id?: string };
  text?: string;
  message_id?: string;
  media_url?: string;
  timestamp?: number;
}

export async function GET(request: NextRequest) {
  // Для Meta-style verification handshake если Omnichat проксирует
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token') || searchParams.get('token');
  const token = searchParams.get('token') || verifyToken || '';

  if (mode === 'subscribe' && challenge) {
    // просто возвращаем challenge — валидация токена ниже
    const companyId = await findCompanyByWebhookToken(token);
    if (!companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: true, service: 'thermo-crm omnichat webhook' });
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';

    const companyId = await findCompanyByWebhookToken(token);
    if (!companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const body = (await request.json()) as OmnichatWebhookBody;

    // Интересуют только входящие
    if (body.direction && body.direction !== 'in') {
      return NextResponse.json({ ok: true, skipped: 'non-incoming' });
    }

    const channel = body.channel || 'whatsapp';
    const phoneRaw = body.from?.phone || '';
    const phone = phoneRaw.startsWith('+') ? phoneRaw : (phoneRaw ? `+${phoneRaw.replace(/\D/g, '')}` : '');
    const chatId = body.from?.id || (phoneRaw ? `${phoneRaw.replace(/\D/g, '')}@c.us` : '');
    const profileName = body.from?.name || '';
    const text = body.text || '';
    const mediaUrl = body.media_url || '';
    const msgId = body.message_id || '';

    if (!chatId || !phone) {
      return NextResponse.json({ error: 'from.phone or from.id required' }, { status: 400 });
    }

    const sql = await getDb();

    // Клиент по телефону в компании
    const existing = await sql`
      SELECT id FROM clients WHERE company_id = ${companyId} AND phone = ${phone} LIMIT 1
    `;

    let clientId: number;
    if (existing.length > 0) {
      clientId = Number(existing[0].id);
      await sql`
        UPDATE clients
        SET wa_chat_id = COALESCE(NULLIF(wa_chat_id, ''), ${chatId}),
            wa_profile_name = COALESCE(NULLIF(wa_profile_name, ''), ${profileName})
        WHERE id = ${clientId}
      `;
    } else {
      const created = await sql`
        INSERT INTO clients (name, phone, source, company_id, wa_chat_id, wa_profile_name)
        VALUES (${profileName || phone}, ${phone}, ${channel}, ${companyId}, ${chatId}, ${profileName})
        RETURNING id
      `;
      clientId = Number(created[0].id);

      await sql`
        INSERT INTO leads (name, phone, source, message, status, client_id, company_id)
        VALUES (${profileName || phone}, ${phone}, ${channel}, ${text}, 'new', ${clientId}, ${companyId})
      `;
    }

    await sql`
      INSERT INTO whatsapp_messages (
        company_id, client_id, wa_chat_id, wa_phone, wa_profile_name,
        direction, message_type, text, media_url, provider, provider_msg_id, is_read
      ) VALUES (
        ${companyId}, ${clientId}, ${chatId}, ${phone}, ${profileName},
        'in', 'text', ${text}, ${mediaUrl}, 'omnichat', ${msgId}, false
      )
    `;

    return NextResponse.json({ ok: true, client_id: clientId });
  } catch (error) {
    console.error('Omnichat webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
