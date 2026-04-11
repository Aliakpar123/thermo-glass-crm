import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const messages = await sql`
      SELECT * FROM deal_messages
      WHERE order_id = ${Number(id)}
      ORDER BY created_at ASC
    `;

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();

    // Get client_id from order
    const orderRows = await sql`SELECT client_id FROM orders WHERE id = ${Number(id)}`;
    const clientId = orderRows[0]?.client_id || null;

    // Mode B: Paste WhatsApp chat
    if (body.chat_text) {
      const lines = body.chat_text.split('\n');
      const messageRegex = /^(\d{1,2}\.\d{1,2}\.\d{4}),?\s*(\d{1,2}:\d{2})\s*-\s*([^:]+):\s*(.+)$/;
      const senderName = body.sender_name || '';
      let matchCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(messageRegex);
        if (match) {
          const [, date, time, name, text] = match;
          const sender = name.trim() === senderName ? 'manager' : 'client';
          // Parse date from DD.MM.YYYY format
          const [day, month, year] = date.split('.');
          const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}:00`;
          await sql`INSERT INTO deal_messages (order_id, client_id, sender, sender_name, message, created_at)
            VALUES (${Number(id)}, ${clientId}, ${sender}, ${name.trim()}, ${text.trim()}, ${dateStr})`;
          matchCount++;
        }
      }

      // If no regex matches found, treat each line as a client message
      if (matchCount === 0) {
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          await sql`INSERT INTO deal_messages (order_id, client_id, sender, sender_name, message)
            VALUES (${Number(id)}, ${clientId}, ${'client'}, ${'Клиент'}, ${trimmed})`;
        }
      }

      const messages = await sql`
        SELECT * FROM deal_messages
        WHERE order_id = ${Number(id)}
        ORDER BY created_at ASC
      `;
      return NextResponse.json(messages);
    }

    // Mode A: Single message
    const { sender = 'manager', sender_name = '', message } = body;
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await sql`INSERT INTO deal_messages (order_id, client_id, sender, sender_name, message)
      VALUES (${Number(id)}, ${clientId}, ${sender}, ${sender_name}, ${message})`;

    const messages = await sql`
      SELECT * FROM deal_messages
      WHERE order_id = ${Number(id)}
      ORDER BY created_at ASC
    `;
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
