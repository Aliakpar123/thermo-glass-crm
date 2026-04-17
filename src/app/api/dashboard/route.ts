import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) {
      return NextResponse.json({
        revenue_today: 0, revenue_week: 0, revenue_month: 0, revenue_prev_month: 0,
        revenue_daily: [], new_leads: 0, active_orders: 0, completed_month: 0, total_clients: 0,
        funnel: { leads: 0, clients: 0, orders: 0, completed: 0 },
        staff_activity: [], overdue_orders: [], recent_activity: [],
      });
    }

    const [
      revTodayRes,
      revWeekRes,
      revMonthRes,
      revPrevMonthRes,
      revDailyRes,
      newLeadsRes,
      activeOrdersRes,
      completedMonthRes,
      totalClientsRes,
      funnelLeadsRes,
      funnelClientsRes,
      funnelOrdersRes,
      funnelCompletedRes,
      staffActivityRes,
      overdueRes,
      recentActivityRes,
    ] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount),0) as val FROM orders WHERE company_id = ${companyId} AND status='completed' AND created_at >= CURRENT_DATE`,
      sql`SELECT COALESCE(SUM(amount),0) as val FROM orders WHERE company_id = ${companyId} AND status='completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      sql`SELECT COALESCE(SUM(amount),0) as val FROM orders WHERE company_id = ${companyId} AND status='completed' AND created_at >= date_trunc('month', CURRENT_DATE)`,
      sql`SELECT COALESCE(SUM(amount),0) as val FROM orders WHERE company_id = ${companyId} AND status='completed' AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)`,
      sql`SELECT to_char(created_at, 'YYYY-MM-DD') as date, COALESCE(SUM(amount),0) as revenue FROM orders WHERE company_id = ${companyId} AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
      sql`SELECT COUNT(*) as val FROM leads WHERE company_id = ${companyId} AND status = 'new'`,
      sql`SELECT COUNT(*) as val FROM orders WHERE company_id = ${companyId} AND status NOT IN ('completed','cancelled')`,
      sql`SELECT COUNT(*) as val FROM orders WHERE company_id = ${companyId} AND status='completed' AND created_at >= date_trunc('month', CURRENT_DATE)`,
      sql`SELECT COUNT(*) as val FROM clients WHERE company_id = ${companyId}`,
      sql`SELECT COUNT(*) as val FROM leads WHERE company_id = ${companyId}`,
      sql`SELECT COUNT(*) as val FROM clients WHERE company_id = ${companyId}`,
      sql`SELECT COUNT(*) as val FROM orders WHERE company_id = ${companyId}`,
      sql`SELECT COUNT(*) as val FROM orders WHERE company_id = ${companyId} AND status='completed'`,
      sql`SELECT al.user_name as name, u.role, COUNT(*) as actions_today
          FROM activity_log al
          LEFT JOIN users u ON al.user_id = u.id
          JOIN user_companies uc ON uc.user_id = al.user_id AND uc.company_id = ${companyId}
          WHERE al.created_at >= CURRENT_DATE
          GROUP BY al.user_name, u.role`,
      sql`SELECT o.id, c.name as client_name, o.status, EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_since_update FROM orders o LEFT JOIN clients c ON o.client_id = c.id WHERE o.company_id = ${companyId} AND o.status NOT IN ('completed','cancelled') AND o.updated_at < NOW() - INTERVAL '7 days' ORDER BY o.updated_at ASC LIMIT 10`,
      sql`SELECT al.user_name, al.action, al.entity_type, al.details, al.created_at
          FROM activity_log al
          JOIN user_companies uc ON uc.user_id = al.user_id AND uc.company_id = ${companyId}
          ORDER BY al.created_at DESC LIMIT 10`,
    ]);

    return NextResponse.json({
      revenue_today: Number(revTodayRes[0].val),
      revenue_week: Number(revWeekRes[0].val),
      revenue_month: Number(revMonthRes[0].val),
      revenue_prev_month: Number(revPrevMonthRes[0].val),
      revenue_daily: revDailyRes.map((r: Record<string, unknown>) => ({
        date: r.date as string,
        revenue: Number(r.revenue),
      })),
      new_leads: Number(newLeadsRes[0].val),
      active_orders: Number(activeOrdersRes[0].val),
      completed_month: Number(completedMonthRes[0].val),
      total_clients: Number(totalClientsRes[0].val),
      funnel: {
        leads: Number(funnelLeadsRes[0].val),
        clients: Number(funnelClientsRes[0].val),
        orders: Number(funnelOrdersRes[0].val),
        completed: Number(funnelCompletedRes[0].val),
      },
      staff_activity: staffActivityRes.map((s: Record<string, unknown>) => ({
        name: s.name as string,
        role: (s.role as string) || 'unknown',
        actions_today: Number(s.actions_today),
      })),
      overdue_orders: overdueRes.map((o: Record<string, unknown>) => ({
        id: Number(o.id),
        client_name: (o.client_name as string) || '',
        status: o.status as string,
        days_since_update: Number(o.days_since_update),
      })),
      recent_activity: recentActivityRes.map((a: Record<string, unknown>) => ({
        user_name: (a.user_name as string) || '',
        action: a.action as string,
        entity_type: a.entity_type as string,
        details: (a.details as string) || '',
        created_at: a.created_at as string,
      })),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
