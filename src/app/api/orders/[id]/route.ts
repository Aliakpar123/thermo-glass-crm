import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const rows = await sql`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.city as client_city, c.source as client_source, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ${Number(id)}
    `;
    const row = rows[0] as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const history = await sql`
      SELECT oh.*, u.name as user_name
      FROM order_history oh
      LEFT JOIN users u ON oh.changed_by = u.id
      WHERE oh.order_id = ${Number(id)}
      ORDER BY oh.created_at DESC
    `;

    return NextResponse.json({ ...row, history });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const {
      client_id, manager_id, product_type, description,
      dimensions, quantity, amount, prepayment, status,
      factory_order_number, comment, changed_by, loss_reason,
      object_city, items_json, heating_type, required_power,
      multifunctional_glass, glass_color, room_type, room_area, total_area,
      next_action_date, next_action_text, client_pain
    } = body;

    const existingRows = await sql`SELECT * FROM orders WHERE id = ${Number(id)}`;
    const existing = existingRows[0] as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const newStatus = status ?? existing.status;

    await sql`
      UPDATE orders
      SET client_id = ${client_id ?? existing.client_id},
          manager_id = ${manager_id ?? existing.manager_id},
          product_type = ${product_type ?? existing.product_type},
          description = ${description ?? existing.description},
          dimensions = ${dimensions ?? existing.dimensions},
          quantity = ${quantity ?? existing.quantity},
          amount = ${amount ?? existing.amount},
          prepayment = ${prepayment ?? existing.prepayment},
          status = ${newStatus},
          factory_order_number = ${factory_order_number ?? existing.factory_order_number},
          loss_reason = ${loss_reason !== undefined ? loss_reason : (existing.loss_reason || '')},
          object_city = ${object_city ?? existing.object_city},
          items_json = ${items_json ?? existing.items_json},
          heating_type = ${heating_type ?? existing.heating_type},
          required_power = ${required_power ?? existing.required_power},
          multifunctional_glass = ${multifunctional_glass ?? existing.multifunctional_glass},
          glass_color = ${glass_color ?? existing.glass_color},
          room_type = ${room_type ?? existing.room_type},
          room_area = ${room_area ?? existing.room_area},
          total_area = ${total_area ?? existing.total_area},
          next_action_date = ${next_action_date !== undefined ? next_action_date : existing.next_action_date},
          next_action_text = ${next_action_text !== undefined ? next_action_text : existing.next_action_text},
          client_pain = ${client_pain !== undefined ? client_pain : (existing.client_pain || '')},
          updated_at = NOW()
      WHERE id = ${Number(id)}
    `;

    if (status && status !== existing.status) {
      await sql`
        INSERT INTO order_history (order_id, status, changed_by, comment)
        VALUES (${Number(id)}, ${status}, ${changed_by || existing.manager_id}, ${comment || `Статус изменён на "${status}"`})
      `;
      await sql`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (${changed_by || existing.manager_id}, '', 'Изменил статус', 'deal', ${Number(id)}, ${'→ ' + status})`;
    }

    const updated = await sql`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.city as client_city, c.source as client_source, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ${Number(id)}
    `;

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
