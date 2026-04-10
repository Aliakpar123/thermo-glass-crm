import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const sql = await getDb();

    const deals = await sql`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.city as client_city,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_in_stage
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      ORDER BY o.updated_at DESC
    `;

    return NextResponse.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { name, phone, source, comment, product_type, amount, manager_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
    }

    // 1. Find existing client by phone or create new one
    const existing = await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`;
    let clientId: number;

    if (existing.length > 0) {
      clientId = existing[0].id;
    } else {
      const newClient = await sql`
        INSERT INTO clients (name, phone, source)
        VALUES (${name}, ${phone}, ${source || 'other'})
        RETURNING id
      `;
      clientId = newClient[0].id;
    }

    // 2. Create order linked to client
    const mgr = manager_id || 1;
    const result = await sql`
      INSERT INTO orders (client_id, manager_id, product_type, amount, status, description)
      VALUES (${clientId}, ${mgr}, ${product_type || 'steklopaket'}, ${amount || 0}, 'new', ${comment || ''})
      RETURNING id
    `;
    const orderId = result[0].id;

    // 3. Add history entry
    await sql`
      INSERT INTO order_history (order_id, status, changed_by, comment)
      VALUES (${orderId}, 'new', ${mgr}, ${comment || 'Сделка создана'})
    `;

    // 4. Return the deal with all joined data
    const deal = await sql`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.city as client_city,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_in_stage
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ${orderId}
    `;

    return NextResponse.json(deal[0], { status: 201 });
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
