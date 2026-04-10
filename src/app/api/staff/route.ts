import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Build date filter condition
    let dateCondition = '';
    if (period === 'month') {
      dateCondition = `created_at >= date('now', '-1 month')`;
    } else if (period === 'week') {
      dateCondition = `created_at >= date('now', '-7 days')`;
    }

    // Get all managers (client_manager and admin roles)
    const managers = db.prepare(`
      SELECT id, name, email, role FROM users
      WHERE role IN ('client_manager', 'admin', 'order_manager')
      ORDER BY name
    `).all() as Array<Record<string, unknown>>;

    const staffKpi = managers.map((manager) => {
      // Leads count
      const leadsCountQuery = dateCondition
        ? `SELECT COUNT(*) as count FROM leads l WHERE l.assigned_to = ? AND l.${dateCondition}`
        : `SELECT COUNT(*) as count FROM leads l WHERE l.assigned_to = ?`;
      const leadsCount = db.prepare(leadsCountQuery).get(manager.id) as { count: number };

      // Orders count
      const ordersCountQuery = dateCondition
        ? `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ? AND o.${dateCondition}`
        : `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ?`;
      const ordersCount = db.prepare(ordersCountQuery).get(manager.id) as { count: number };

      // Orders sent to factory
      const ordersSentQuery = dateCondition
        ? `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ? AND o.status IN ('factory', 'production', 'delivery', 'installation', 'completed') AND o.${dateCondition}`
        : `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ? AND o.status IN ('factory', 'production', 'delivery', 'installation', 'completed')`;
      const ordersSentToFactory = db.prepare(ordersSentQuery).get(manager.id) as { count: number };

      // Orders completed
      const ordersCompletedQuery = dateCondition
        ? `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ? AND o.status = 'completed' AND o.${dateCondition}`
        : `SELECT COUNT(*) as count FROM orders o WHERE o.manager_id = ? AND o.status = 'completed'`;
      const ordersCompleted = db.prepare(ordersCompletedQuery).get(manager.id) as { count: number };

      // Total revenue & avg check
      const revenueQuery = dateCondition
        ? `SELECT COALESCE(SUM(o.amount), 0) as total_revenue, AVG(CASE WHEN o.amount > 0 THEN o.amount END) as avg_check FROM orders o WHERE o.manager_id = ? AND o.status != 'cancelled' AND o.${dateCondition}`
        : `SELECT COALESCE(SUM(o.amount), 0) as total_revenue, AVG(CASE WHEN o.amount > 0 THEN o.amount END) as avg_check FROM orders o WHERE o.manager_id = ? AND o.status != 'cancelled'`;
      const revenueData = db.prepare(revenueQuery).get(manager.id) as { total_revenue: number; avg_check: number | null };

      return {
        id: manager.id,
        name: manager.name,
        email: manager.email,
        role: manager.role,
        leads_count: leadsCount.count,
        orders_count: ordersCount.count,
        orders_sent_to_factory: ordersSentToFactory.count,
        orders_completed: ordersCompleted.count,
        total_revenue: revenueData.total_revenue,
        avg_check: revenueData.avg_check ? Math.round(Number(revenueData.avg_check)) : 0,
      };
    });

    return NextResponse.json(staffKpi);
  } catch (error) {
    console.error('Error fetching staff KPI:', error);
    return NextResponse.json({ error: 'Failed to fetch staff KPI' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, email, role, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update name, email, role
    if (name || email || role) {
      db.prepare(`
        UPDATE users SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          role = COALESCE(?, role)
        WHERE id = ?
      `).run(name || null, email || null, role || null, id);
    }

    // Update password if provided
    if (password && password.trim().length >= 4) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    }

    const updated = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}
