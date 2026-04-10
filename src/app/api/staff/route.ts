import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Determine interval for date filtering
    let intervalStr: string | null = null;
    if (period === 'month') intervalStr = '1 month';
    else if (period === 'week') intervalStr = '7 days';

    const hasDateFilter = intervalStr !== null;

    // Get all managers
    const managers = await sql`
      SELECT id, name, email, role FROM users
      WHERE role IN ('client_manager', 'admin', 'order_manager')
      ORDER BY name
    `;

    const staffKpi = await Promise.all((managers as Array<Record<string, unknown>>).map(async (manager) => {
      let leadsCountRow;
      let ordersCountRow;
      let ordersSentRow;
      let ordersCompletedRow;
      let revenueRow;

      if (hasDateFilter) {
        leadsCountRow = await sql`
          SELECT COUNT(*)::int as count FROM leads l
          WHERE l.assigned_to = ${manager.id} AND l.created_at >= NOW() - ${intervalStr}::interval
        `;
        ordersCountRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id} AND o.created_at >= NOW() - ${intervalStr}::interval
        `;
        ordersSentRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id} AND o.status IN ('factory', 'production', 'delivery', 'installation', 'completed') AND o.created_at >= NOW() - ${intervalStr}::interval
        `;
        ordersCompletedRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id} AND o.status = 'completed' AND o.created_at >= NOW() - ${intervalStr}::interval
        `;
        revenueRow = await sql`
          SELECT COALESCE(SUM(o.amount), 0)::numeric as total_revenue, AVG(CASE WHEN o.amount > 0 THEN o.amount END)::numeric as avg_check
          FROM orders o WHERE o.manager_id = ${manager.id} AND o.status != 'cancelled' AND o.created_at >= NOW() - ${intervalStr}::interval
        `;
      } else {
        leadsCountRow = await sql`
          SELECT COUNT(*)::int as count FROM leads l WHERE l.assigned_to = ${manager.id}
        `;
        ordersCountRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o WHERE o.manager_id = ${manager.id}
        `;
        ordersSentRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id} AND o.status IN ('factory', 'production', 'delivery', 'installation', 'completed')
        `;
        ordersCompletedRow = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id} AND o.status = 'completed'
        `;
        revenueRow = await sql`
          SELECT COALESCE(SUM(o.amount), 0)::numeric as total_revenue, AVG(CASE WHEN o.amount > 0 THEN o.amount END)::numeric as avg_check
          FROM orders o WHERE o.manager_id = ${manager.id} AND o.status != 'cancelled'
        `;
      }

      const leadsCount = leadsCountRow[0] as { count: number };
      const ordersCount = ordersCountRow[0] as { count: number };
      const ordersSentToFactory = ordersSentRow[0] as { count: number };
      const ordersCompleted = ordersCompletedRow[0] as { count: number };
      const revenueData = revenueRow[0] as { total_revenue: number; avg_check: number | null };

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
    }));

    return NextResponse.json(staffKpi);
  } catch (error) {
    console.error('Error fetching staff KPI:', error);
    return NextResponse.json({ error: 'Failed to fetch staff KPI' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sql = await getDb();
    const body = await request.json();
    const { id, name, email, role, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const userRows = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (!userRows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (name || email || role) {
      await sql`
        UPDATE users SET
          name = COALESCE(${name || null}, name),
          email = COALESCE(${email || null}, email),
          role = COALESCE(${role || null}, role)
        WHERE id = ${id}
      `;
    }

    if (password && password.trim().length >= 4) {
      const hash = bcrypt.hashSync(password, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
    }

    const updated = await sql`SELECT id, name, email, role FROM users WHERE id = ${id}`;
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}
