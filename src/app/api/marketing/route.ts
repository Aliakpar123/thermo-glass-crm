import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Build date filter condition
    let dateCondition = '';
    if (period === 'week') {
      dateCondition = `created_at >= date('now', '-7 days')`;
    } else if (period === 'month') {
      dateCondition = `created_at >= date('now', '-1 month')`;
    } else if (period === 'quarter') {
      dateCondition = `created_at >= date('now', '-3 months')`;
    } else if (period === 'year') {
      dateCondition = `created_at >= date('now', '-1 year')`;
    }

    // Sources distribution from clients
    const sourcesQuery = dateCondition
      ? `SELECT c.source, COUNT(*) as count FROM clients c WHERE c.${dateCondition} GROUP BY c.source ORDER BY count DESC`
      : `SELECT c.source, COUNT(*) as count FROM clients c GROUP BY c.source ORDER BY count DESC`;
    const sourcesDistribution = db.prepare(sourcesQuery).all();

    // Monthly revenue (last 12 months)
    const monthlyRevenue = db.prepare(`
      SELECT
        strftime('%Y-%m', o.created_at) as month,
        SUM(o.amount) as revenue,
        COUNT(*) as orders_count
      FROM orders o
      WHERE o.status != 'cancelled'
      GROUP BY strftime('%Y-%m', o.created_at)
      ORDER BY month DESC
      LIMIT 12
    `).all();

    // Conversion rates: leads to clients
    const totalLeadsQuery = dateCondition
      ? `SELECT COUNT(*) as count FROM leads l WHERE l.${dateCondition}`
      : `SELECT COUNT(*) as count FROM leads l`;
    const totalLeads = db.prepare(totalLeadsQuery).get() as { count: number };

    const convertedLeadsQuery = dateCondition
      ? `SELECT COUNT(*) as count FROM leads l WHERE l.status = 'converted' AND l.${dateCondition}`
      : `SELECT COUNT(*) as count FROM leads l WHERE l.status = 'converted'`;
    const convertedLeads = db.prepare(convertedLeadsQuery).get() as { count: number };

    const conversionRate = totalLeads.count > 0
      ? ((convertedLeads.count / totalLeads.count) * 100).toFixed(1)
      : '0';

    // Popular products
    const popularProductsQuery = dateCondition
      ? `SELECT o.product_type, COUNT(*) as count, SUM(o.amount) as total_revenue FROM orders o WHERE o.status != 'cancelled' AND o.${dateCondition} GROUP BY o.product_type ORDER BY count DESC`
      : `SELECT o.product_type, COUNT(*) as count, SUM(o.amount) as total_revenue FROM orders o WHERE o.status != 'cancelled' GROUP BY o.product_type ORDER BY count DESC`;
    const popularProducts = db.prepare(popularProductsQuery).all();

    // Average check
    const avgCheckQuery = dateCondition
      ? `SELECT AVG(o.amount) as avg_check, SUM(o.amount) as total_revenue, COUNT(*) as total_orders FROM orders o WHERE o.status != 'cancelled' AND o.amount > 0 AND o.${dateCondition}`
      : `SELECT AVG(o.amount) as avg_check, SUM(o.amount) as total_revenue, COUNT(*) as total_orders FROM orders o WHERE o.status != 'cancelled' AND o.amount > 0`;
    const avgCheck = db.prepare(avgCheckQuery).get() as { avg_check: number | null; total_revenue: number | null; total_orders: number };

    // Lead sources distribution
    const leadSourcesQuery = dateCondition
      ? `SELECT l.source, COUNT(*) as count FROM leads l WHERE l.${dateCondition} GROUP BY l.source ORDER BY count DESC`
      : `SELECT l.source, COUNT(*) as count FROM leads l GROUP BY l.source ORDER BY count DESC`;
    const leadSources = db.prepare(leadSourcesQuery).all();

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
    });
  } catch (error) {
    console.error('Error fetching marketing data:', error);
    return NextResponse.json({ error: 'Failed to fetch marketing data' }, { status: 500 });
  }
}
