import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Determine interval for date filtering
    let intervalStr: string | null = null;
    if (period === 'week') intervalStr = '7 days';
    else if (period === 'month') intervalStr = '1 month';
    else if (period === 'quarter') intervalStr = '3 months';
    else if (period === 'year') intervalStr = '1 year';

    const hasDateFilter = intervalStr !== null;

    // Sources distribution from clients
    let sourcesDistribution;
    if (hasDateFilter) {
      sourcesDistribution = await sql`
        SELECT c.source, COUNT(*)::int as count FROM clients c
        WHERE c.created_at >= NOW() - ${intervalStr}::interval
        GROUP BY c.source ORDER BY count DESC
      `;
    } else {
      sourcesDistribution = await sql`
        SELECT c.source, COUNT(*)::int as count FROM clients c
        GROUP BY c.source ORDER BY count DESC
      `;
    }

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await sql`
      SELECT
        to_char(o.created_at, 'YYYY-MM') as month,
        SUM(o.amount)::numeric as revenue,
        COUNT(*)::int as orders_count
      FROM orders o
      WHERE o.status != 'cancelled'
      GROUP BY to_char(o.created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `;

    // Conversion rates: leads to clients
    let totalLeadsRow;
    let convertedLeadsRow;
    if (hasDateFilter) {
      totalLeadsRow = await sql`
        SELECT COUNT(*)::int as count FROM leads l
        WHERE l.created_at >= NOW() - ${intervalStr}::interval
      `;
      convertedLeadsRow = await sql`
        SELECT COUNT(*)::int as count FROM leads l
        WHERE l.status = 'converted' AND l.created_at >= NOW() - ${intervalStr}::interval
      `;
    } else {
      totalLeadsRow = await sql`SELECT COUNT(*)::int as count FROM leads l`;
      convertedLeadsRow = await sql`SELECT COUNT(*)::int as count FROM leads l WHERE l.status = 'converted'`;
    }
    const totalLeads = totalLeadsRow[0] as { count: number };
    const convertedLeads = convertedLeadsRow[0] as { count: number };

    const conversionRate = totalLeads.count > 0
      ? ((convertedLeads.count / totalLeads.count) * 100).toFixed(1)
      : '0';

    // Popular products
    let popularProducts;
    if (hasDateFilter) {
      popularProducts = await sql`
        SELECT o.product_type, COUNT(*)::int as count, SUM(o.amount)::numeric as total_revenue
        FROM orders o WHERE o.status != 'cancelled' AND o.created_at >= NOW() - ${intervalStr}::interval
        GROUP BY o.product_type ORDER BY count DESC
      `;
    } else {
      popularProducts = await sql`
        SELECT o.product_type, COUNT(*)::int as count, SUM(o.amount)::numeric as total_revenue
        FROM orders o WHERE o.status != 'cancelled'
        GROUP BY o.product_type ORDER BY count DESC
      `;
    }

    // Average check
    let avgCheckRow;
    if (hasDateFilter) {
      avgCheckRow = await sql`
        SELECT AVG(o.amount)::numeric as avg_check, SUM(o.amount)::numeric as total_revenue, COUNT(*)::int as total_orders
        FROM orders o WHERE o.status != 'cancelled' AND o.amount > 0 AND o.created_at >= NOW() - ${intervalStr}::interval
      `;
    } else {
      avgCheckRow = await sql`
        SELECT AVG(o.amount)::numeric as avg_check, SUM(o.amount)::numeric as total_revenue, COUNT(*)::int as total_orders
        FROM orders o WHERE o.status != 'cancelled' AND o.amount > 0
      `;
    }
    const avgCheck = avgCheckRow[0] as { avg_check: number | null; total_revenue: number | null; total_orders: number };

    // Lead sources distribution
    let leadSources;
    if (hasDateFilter) {
      leadSources = await sql`
        SELECT l.source, COUNT(*)::int as count FROM leads l
        WHERE l.created_at >= NOW() - ${intervalStr}::interval
        GROUP BY l.source ORDER BY count DESC
      `;
    } else {
      leadSources = await sql`
        SELECT l.source, COUNT(*)::int as count FROM leads l
        GROUP BY l.source ORDER BY count DESC
      `;
    }

    // Funnel counts
    const leadsCountRow = await sql`SELECT COUNT(*)::int as count FROM leads`;
    const clientsCountRow = await sql`SELECT COUNT(*)::int as count FROM clients`;
    const ordersCountRow = await sql`SELECT COUNT(*)::int as count FROM orders WHERE status != 'cancelled'`;
    const completedCountRow = await sql`SELECT COUNT(*)::int as count FROM orders WHERE status = 'completed'`;

    return NextResponse.json({
      sources_distribution: sourcesDistribution,
      monthly_revenue: monthlyRevenue,
      conversion: {
        total_leads: totalLeads.count,
        converted_leads: convertedLeads.count,
        conversion_rate: Number(conversionRate),
      },
      popular_products: popularProducts,
      average_check: avgCheck.avg_check ? Math.round(Number(avgCheck.avg_check)) : 0,
      total_revenue: avgCheck.total_revenue || 0,
      total_orders: avgCheck.total_orders,
      lead_sources: leadSources,
      funnel: {
        leads: (leadsCountRow[0] as { count: number }).count,
        clients: (clientsCountRow[0] as { count: number }).count,
        orders: (ordersCountRow[0] as { count: number }).count,
        completed: (completedCountRow[0] as { count: number }).count,
      },
    });
  } catch (error) {
    console.error('Error fetching marketing data:', error);
    return NextResponse.json({ error: 'Failed to fetch marketing data' }, { status: 500 });
  }
}
