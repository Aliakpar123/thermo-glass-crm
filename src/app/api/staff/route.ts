import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    const useMonth = period === 'month';
    const useWeek = period === 'week';
    const hasDateFilter = useMonth || useWeek;

    // Get all managers (client_manager and admin roles)
    const managers = await sql`
      SELECT id, name, email, role FROM users
      WHERE role IN ('client_manager', 'admin', 'order_manager')
      ORDER BY name
    `;

    const staffKpi = await Promise.all(
      managers.map(async (manager: Record<string, unknown>) => {
        // Leads count
        const leadsCountRows = await sql`
          SELECT COUNT(*)::int as count FROM leads l
          WHERE l.assigned_to = ${manager.id}
            AND (${!hasDateFilter}::boolean OR
              (${useMonth}::boolean AND l.created_at >= NOW() - INTERVAL '1 month') OR
              (${useWeek}::boolean AND l.created_at >= NOW() - INTERVAL '7 days'))
        `;

        // Orders count
        const ordersCountRows = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id}
            AND (${!hasDateFilter}::boolean OR
              (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
              (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days'))
        `;

        // Orders sent to factory
        const ordersSentToFactoryRows = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id}
            AND o.status IN ('factory', 'production', 'delivery', 'installation', 'completed')
            AND (${!hasDateFilter}::boolean OR
              (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
              (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days'))
        `;

        // Orders completed
        const ordersCompletedRows = await sql`
          SELECT COUNT(*)::int as count FROM orders o
          WHERE o.manager_id = ${manager.id}
            AND o.status = 'completed'
            AND (${!hasDateFilter}::boolean OR
              (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
              (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days'))
        `;

        // Total revenue & avg check
        const revenueDataRows = await sql`
          SELECT COALESCE(SUM(o.amount), 0) as total_revenue, AVG(CASE WHEN o.amount > 0 THEN o.amount END) as avg_check
          FROM orders o
          WHERE o.manager_id = ${manager.id}
            AND o.status != 'cancelled'
            AND (${!hasDateFilter}::boolean OR
              (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
              (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days'))
        `;
        const revenueData = revenueDataRows[0] as { total_revenue: number; avg_check: number | null };

        return {
          id: manager.id,
          name: manager.name,
          email: manager.email,
          role: manager.role,
          leads_count: (leadsCountRows[0] as { count: number }).count,
          orders_count: (ordersCountRows[0] as { count: number }).count,
          orders_sent_to_factory: (ordersSentToFactoryRows[0] as { count: number }).count,
          orders_completed: (ordersCompletedRows[0] as { count: number }).count,
          total_revenue: revenueData.total_revenue,
          avg_check: revenueData.avg_check ? Math.round(Number(revenueData.avg_check)) : 0,
        };
      })
    );

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
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update name, email, role
    if (name || email || role) {
      await sql`
        UPDATE users SET
          name = COALESCE(${name || null}, name),
          email = COALESCE(${email || null}, email),
          role = COALESCE(${role || null}, role)
        WHERE id = ${id}
      `;
    }

    // Update password if provided
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
