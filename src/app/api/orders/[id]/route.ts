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
      SELECT o.*, c.name as client_name, u.name as manager_name
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
      factory_order_number, comment, changed_by
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
          updated_at = NOW()
      WHERE id = ${Number(id)}
    `;

    if (status && status !== existing.status) {
      await sql`
        INSERT INTO order_history (order_id, status, changed_by, comment)
        VALUES (${Number(id)}, ${status}, ${changed_by || existing.manager_id}, ${comment || `Статус изменён на "${status}"`})
      `;
    }

    const updated = await sql`
      SELECT o.*, c.name as client_name, u.name as manager_name
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
