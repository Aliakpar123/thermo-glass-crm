import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { phoneFromChatId, findCompanyByWebhookToken } from '@/lib/whatsapp';

// Публичный webhook для Green API.
// URL для Green API: https://<your-app>.vercel.app/api/webhooks/whatsapp?token=<GREEN_API_WEBHOOK_TOKEN>&company=thermo
// company= нужен чтобы понимать в какую компанию холдинга сохранять.

interface GreenApiMessageBody {
  typeWebhook?: string;
  idMessage?: string;
  timestamp?: number;
  senderData?: {
    chatId?: string;
    sender?: string;
    senderName?: string;
    chatName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
    imageMessageData?: { downloadUrl?: string; caption?: string };
    documentMessageData?: { downloadUrl?: string; fileName?: string };
  };
}

export async function GET(request: NextRequest) {
  // Верификатор доступности — просто возвращаем 200 с идентификацией сервиса.
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const envExpected = process.env.GREEN_API_WEBHOOK_TOKEN || '';
  // Если token не задан в env — пропускаем всех (проверка будет в POST через БД).
  if (envExpected && token && token !== envExpected) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, service: 'thermo-crm whatsapp webhook' });
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';
    const companySlug = searchParams.get('company') || '';

    // Определение компании:
    // 1. По токену в БД (предпочтительно — один токен = одна компания)
    // 2. По ?company=<slug> (совместимость с env-конфигом)
    let companyIdFromToken: number | null = null;
    if (token) {
      companyIdFromToken = await findCompanyByWebhookToken(token);
    }
    if (!companyIdFromToken) {
      // fallback на env
      const envExpected = process.env.GREEN_API_WEBHOOK_TOKEN || '';
      if (envExpected && token !== envExpected) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
      }
    }

    const body = (await request.json()) as GreenApiMessageBody;

    // Интересуют только входящие сообщения
    if (body.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ ok: true, skipped: body.typeWebhook });
    }

    const chatId = body.senderData?.chatId || '';
    if (!chatId || !chatId.endsWith('@c.us')) {
      // групповые чаты (@g.us) пока пропускаем
      return NextResponse.json({ ok: true, skipped: 'non-user-chat' });
    }

    const phone = phoneFromChatId(chatId);
    const profileName = body.senderData?.senderName || body.senderData?.chatName || '';
    const msgType = body.messageData?.typeMessage || 'text';

    const text =
      body.messageData?.textMessageData?.textMessage ||
      body.messageData?.extendedTextMessageData?.text ||
      body.messageData?.imageMessageData?.caption ||
      body.messageData?.documentMessageData?.fileName ||
      '';
    const mediaUrl =
      body.messageData?.imageMessageData?.downloadUrl ||
      body.messageData?.documentMessageData?.downloadUrl ||
      '';

    const sql = await getDb();

    let companyId: number;
    if (companyIdFromToken) {
      companyId = companyIdFromToken;
    } else {
      const companies = await sql`SELECT id FROM companies WHERE slug = ${companySlug || 'thermo'} LIMIT 1`;
      if (companies.length === 0) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      companyId = Number(companies[0].id);
    }

    // Ищем клиента по телефону в этой компании
    const existing = await sql`
      SELECT id FROM clients WHERE company_id = ${companyId} AND phone = ${phone} LIMIT 1
    `;

    let clientId: number;
    if (existing.length > 0) {
      clientId = Number(existing[0].id);
      // Обновим wa_chat_id и имя, если не были заданы
      await sql`
        UPDATE clients
        SET wa_chat_id = COALESCE(NULLIF(wa_chat_id, ''), ${chatId}),
            wa_profile_name = COALESCE(NULLIF(wa_profile_name, ''), ${profileName})
        WHERE id = ${clientId}
      `;
    } else {
      // Создаём нового клиента с источником whatsapp
      const created = await sql`
        INSERT INTO clients (name, phone, source, company_id, wa_chat_id, wa_profile_name)
        VALUES (${profileName || phone}, ${phone}, 'whatsapp', ${companyId}, ${chatId}, ${profileName})
        RETURNING id
      `;
      clientId = Number(created[0].id);

      // И создаём новый лид
      await sql`
        INSERT INTO leads (name, phone, source, message, status, client_id, company_id)
        VALUES (${profileName || phone}, ${phone}, 'whatsapp', ${text}, 'new', ${clientId}, ${companyId})
      `;
    }

    // Записываем входящее сообщение
    await sql`
      INSERT INTO whatsapp_messages (
        company_id, client_id, wa_chat_id, wa_phone, wa_profile_name,
        direction, message_type, text, media_url, provider, provider_msg_id, is_read
      ) VALUES (
        ${companyId}, ${clientId}, ${chatId}, ${phone}, ${profileName},
        'in', ${msgType}, ${text}, ${mediaUrl}, 'green-api', ${body.idMessage || ''}, false
      )
    `;

    return NextResponse.json({ ok: true, client_id: clientId });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
