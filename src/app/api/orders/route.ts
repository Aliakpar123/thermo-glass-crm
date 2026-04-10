import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const managerId = searchParams.get('manager_id') || '';
    const clientId = searchParams.get('client_id') || '';
    const search = searchParams.get('search') || '';

    const orders = await sql`
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE (${status} = '' OR o.status = ${status})
        AND (${managerId} = '' OR o.manager_id = ${managerId === '' ? 0 : Number(managerId)})
        AND (${clientId} = '' OR o.client_id = ${clientId === '' ? 0 : Number(clientId)})
        AND (${search} = '' OR c.name ILIKE ${'%' + search + '%'} OR o.description ILIKE ${'%' + search + '%'} OR o.factory_order_number ILIKE ${'%' + search + '%'})
      ORDER BY o.created_at DESC
    `;

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const {
      client_id, manager_id, product_type, description,
      dimensions, quantity, amount, prepayment, status,
      factory_order_number, comment, changed_by, lead_id,
      object_city, items_json, heating_type, required_power,
      multifunctional_glass, glass_color, room_type, room_area, total_area
    } = body;

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const mgr = manager_id || 1;
    const orderStatus = status || 'new';

    const result = await sql`
      INSERT INTO orders (client_id, manager_id, lead_id, product_type, description, dimensions, quantity, amount, prepayment, status, factory_order_number, object_city, items_json, heating_type, required_power, multifunctional_glass, glass_color, room_type, room_area, total_area)
      VALUES (${client_id}, ${mgr}, ${lead_id || null}, ${product_type || 'steklopaket'}, ${description || ''}, ${dimensions || ''}, ${quantity || 1}, ${amount || 0}, ${prepayment || 0}, ${orderStatus}, ${factory_order_number || ''}, ${object_city || ''}, ${items_json || '[]'}, ${heating_type || ''}, ${required_power || 0}, ${multifunctional_glass || 'нет'}, ${glass_color || 'прозрачная'}, ${room_type || ''}, ${room_area || 0}, ${total_area || 0})
      RETURNING id
    `;

    const orderId = result[0].id;

    await sql`
      INSERT INTO order_history (order_id, status, changed_by, comment)
      VALUES (${orderId}, ${orderStatus}, ${changed_by || manager_id}, ${comment || 'Заказ создан'})
    `;

    const order = await sql`
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ${orderId}
    `;

    return NextResponse.json(order[0], { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
