import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = db.prepare(`
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ?
    `).get(Number(id)) as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const history = db.prepare(`
      SELECT oh.*, u.name as user_name
      FROM order_history oh
      LEFT JOIN users u ON oh.changed_by = u.id
      WHERE oh.order_id = ?
      ORDER BY oh.created_at DESC
    `).all(Number(id));

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
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const {
      client_id, manager_id, product_type, description,
      dimensions, quantity, amount, prepayment, status,
      factory_order_number, comment, changed_by
    } = body;

    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id)) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const newStatus = status ?? existing.status;

    db.prepare(`
      UPDATE orders
      SET client_id = ?,
          manager_id = ?,
          product_type = ?,
          description = ?,
          dimensions = ?,
          quantity = ?,
          amount = ?,
          prepayment = ?,
          status = ?,
          factory_order_number = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      client_id ?? existing.client_id,
      manager_id ?? existing.manager_id,
      product_type ?? existing.product_type,
      description ?? existing.description,
      dimensions ?? existing.dimensions,
      quantity ?? existing.quantity,
      amount ?? existing.amount,
      prepayment ?? existing.prepayment,
      newStatus,
      factory_order_number ?? existing.factory_order_number,
      Number(id)
    );

    // Add history entry if status changed
    if (status && status !== existing.status) {
      db.prepare(`
        INSERT INTO order_history (order_id, status, changed_by, comment)
        VALUES (?, ?, ?, ?)
      `).run(Number(id), status, changed_by || existing.manager_id, comment || `Статус изменён на "${status}"`);
    }

    const updated = db.prepare(`
      SELECT o.*, c.name as client_name, u.name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = ?
    `).get(Number(id));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
