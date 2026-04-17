import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const deals = await sql`
      SELECT o.*, o.next_action_date, o.next_action_text, c.name as client_name, c.phone as client_phone, c.city as client_city,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_in_stage
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.archived_at IS NULL AND o.company_id = ${companyId}
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
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const body = await request.json();
    const { name, phone, city, source, comment, product_type, amount, manager_id, existing_client_id, client_pain } = body;

    if (!existing_client_id && (!name || !phone)) {
      return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
    }

    let clientId: number;

    if (existing_client_id) {
      // User confirmed: create deal for existing client
      clientId = existing_client_id;
    } else {
      // 1. Check for duplicate client by phone (в рамках текущей компании)
      const existing = await sql`SELECT id, name, phone, city, source, created_at FROM clients WHERE phone = ${phone} AND company_id = ${companyId} LIMIT 1`;

      if (existing.length > 0) {
        // Return duplicate info so frontend can ask user what to do
        return NextResponse.json(
          {
            duplicate: true,
            existing_client: existing[0],
            message: 'Клиент с таким телефоном уже есть',
          },
          { status: 409 }
        );
      }

      const newClient = await sql`
        INSERT INTO clients (name, phone, city, source, company_id)
        VALUES (${name}, ${phone}, ${city || ''}, ${source || 'other'}, ${companyId})
        RETURNING id
      `;
      clientId = newClient[0].id;
    }

    // 2. Create order linked to client
    const mgr = manager_id || 1;
    const result = await sql`
      INSERT INTO orders (client_id, manager_id, product_type, amount, status, description, client_pain, company_id)
      VALUES (${clientId}, ${mgr}, ${product_type || 'steklopaket'}, ${amount || 0}, 'new', ${comment || ''}, ${client_pain || ''}, ${companyId})
      RETURNING id
    `;
    const orderId = result[0].id;

    // 3. Add history entry
    await sql`
      INSERT INTO order_history (order_id, status, changed_by, comment)
      VALUES (${orderId}, 'new', ${mgr}, ${comment || 'Сделка создана'})
    `;

    await sql`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (${mgr}, '', 'Создал сделку', 'deal', ${orderId}, ${(name || '') + ' ' + (phone || '')})`;

    // 3.5 Auto-task: set reminder "Позвонить" in 2 hours
    await sql`
      UPDATE orders
      SET next_action_date = NOW() + INTERVAL '2 hours',
          next_action_text = 'Позвонить клиенту'
      WHERE id = ${orderId}
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
