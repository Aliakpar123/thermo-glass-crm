import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const managerId = searchParams.get('manager_id') || '';
    const clientId = searchParams.get('client_id') || '';
    const search = searchParams.get('search') || '';

    let query = `
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }
    if (managerId) {
      query += ` AND o.manager_id = ?`;
      params.push(Number(managerId));
    }
    if (clientId) {
      query += ` AND o.client_id = ?`;
      params.push(Number(clientId));
    }
    if (search) {
      query += ` AND (c.name LIKE ? OR o.description LIKE ? OR o.factory_order_number LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ` ORDER BY o.created_at DESC`;

    const orders = db.prepare(query).all(...params);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
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

    // Use manager_id from body or default to 1 (admin)
    const mgr = manager_id || 1;
    const orderStatus = status || 'new';

    const result = db.prepare(`
      INSERT INTO orders (client_id, manager_id, lead_id, product_type, description, dimensions, quantity, amount, prepayment, status, factory_order_number, object_city, items_json, heating_type, required_power, multifunctional_glass, glass_color, room_type, room_area, total_area)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client_id, mgr, lead_id || null, product_type || 'steklopaket', description || '', dimensions || '', quantity || 1, amount || 0, prepayment || 0, orderStatus, factory_order_number || '', object_city || '', items_json || '[]', heating_type || '', required_power || 0, multifunctional_glass || 'нет', glass_color || 'прозрачная', room_type || '', room_area || 0, total_area || 0);

    const orderId = result.lastInsertRowid;

    // Add initial history entry
    db.prepare(`
      INSERT INTO order_history (order_id, status, changed_by, comment)
      VALUES (?, ?, ?, ?)
    `).run(orderId, orderStatus, changed_by || manager_id, comment || 'Заказ создан');

    const order = db.prepare(`
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
