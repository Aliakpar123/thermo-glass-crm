import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import {
  findCompanyByMetaPhoneNumberId,
  findCompanyByMetaVerifyToken,
} from '@/lib/whatsapp';

// Webhook для Meta WhatsApp Cloud API.
// Meta делает два типа вызовов:
//   1. GET  — handshake: ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
//             ожидает plain-text ответ `YYY`, если verify_token совпадает.
//   2. POST — события (сообщения, статусы) в формате:
//             { "object": "whatsapp_business_account",
//               "entry": [{ "changes": [{ "value": {...}, "field": "messages" }]}] }

// GET handshake
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const verifyToken = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  if (mode === 'subscribe' && challenge) {
    const found = await findCompanyByMetaVerifyToken(verifyToken);
    if (!found) {
      // fallback: разрешаем если совпадает с ENV (для совместимости)
      const envToken = process.env.META_WHATSAPP_VERIFY_TOKEN || '';
      if (envToken && verifyToken === envToken) {
        return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      return NextResponse.json({ error: 'Invalid verify_token' }, { status: 403 });
    }
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ ok: true, service: 'thermo-crm whatsapp-meta webhook' });
}

interface MetaWebhookBody {
  object?: string;
  entry?: Array<{
    id?: string; // WABA ID
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; mime_type?: string; caption?: string };
          document?: { id?: string; filename?: string; mime_type?: string; caption?: string };
          audio?: { id?: string; mime_type?: string };
          video?: { id?: string; mime_type?: string; caption?: string };
        }>;
        statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
      };
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetaWebhookBody;

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true, skipped: 'non-waba-event' });
    }

    const sql = await getDb();
    let processed = 0;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id || '';

        // Находим компанию по phone_number_id из нашего конфига
        const companyMatch = await findCompanyByMetaPhoneNumberId(phoneNumberId);
        if (!companyMatch) continue;
        const companyId = companyMatch.companyId;

        // Пропускаем статусы (отправлено/доставлено/прочитано) — нам сейчас не нужны
        if (!value.messages || value.messages.length === 0) continue;

        for (const msg of value.messages) {
          const from = msg.from || '';
          if (!from) continue;

          const phone = `+${from.replace(/\D/g, '')}`;
          const chatId = `${from}@c.us`;
          // Имя из contacts с тем же wa_id
          const contact = (value.contacts || []).find((c) => c.wa_id === from);
          const profileName = contact?.profile?.name || '';

          let text = '';
          let mediaUrl = '';
          const msgType = msg.type || 'text';
          if (msg.type === 'text') text = msg.text?.body || '';
          else if (msg.type === 'image') {
            text = msg.image?.caption || '';
            mediaUrl = msg.image?.id ? `meta-media://${msg.image.id}` : '';
          } else if (msg.type === 'document') {
            text = msg.document?.caption || msg.document?.filename || '';
            mediaUrl = msg.document?.id ? `meta-media://${msg.document.id}` : '';
          } else if (msg.type === 'audio') {
            text = '[голосовое сообщение]';
            mediaUrl = msg.audio?.id ? `meta-media://${msg.audio.id}` : '';
          } else if (msg.type === 'video') {
            text = msg.video?.caption || '';
            mediaUrl = msg.video?.id ? `meta-media://${msg.video.id}` : '';
          }

          // Upsert клиент по телефону
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
              VALUES (${profileName || phone}, ${phone}, 'whatsapp', ${companyId}, ${chatId}, ${profileName})
              RETURNING id
            `;
            clientId = Number(created[0].id);

            await sql`
              INSERT INTO leads (name, phone, source, message, status, client_id, company_id)
              VALUES (${profileName || phone}, ${phone}, 'whatsapp', ${text}, 'new', ${clientId}, ${companyId})
            `;
          }

          await sql`
            INSERT INTO whatsapp_messages (
              company_id, client_id, wa_chat_id, wa_phone, wa_profile_name,
              direction, message_type, text, media_url, provider, provider_msg_id, is_read
            ) VALUES (
              ${companyId}, ${clientId}, ${chatId}, ${phone}, ${profileName},
              'in', ${msgType}, ${text}, ${mediaUrl}, 'meta-cloud', ${msg.id || ''}, false
            )
          `;
          processed++;
        }
      }
    }

    // Meta ожидает 200 OK быстро, иначе повторит
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error('Meta WhatsApp webhook error:', error);
    // Всё равно возвращаем 200, чтобы Meta не ретраила — логируем у себя
    return NextResponse.json({ ok: false, error: 'internal' });
  }
}
