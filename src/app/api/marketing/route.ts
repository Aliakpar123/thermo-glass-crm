import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Build date interval conditions using PostgreSQL syntax
    const useMonth = period === 'month';
    const useWeek = period === 'week';
    const useQuarter = period === 'quarter';
    const useYear = period === 'year';
    const hasDateFilter = useMonth || useWeek || useQuarter || useYear;

    // Sources distribution from clients
    const sourcesDistribution = await sql`
      SELECT c.source, COUNT(*)::int as count
      FROM clients c
      WHERE (${!hasDateFilter}::boolean OR
        (${useMonth}::boolean AND c.created_at >= NOW() - INTERVAL '1 month') OR
        (${useWeek}::boolean AND c.created_at >= NOW() - INTERVAL '7 days') OR
        (${useQuarter}::boolean AND c.created_at >= NOW() - INTERVAL '3 months') OR
        (${useYear}::boolean AND c.created_at >= NOW() - INTERVAL '1 year'))
      GROUP BY c.source
      ORDER BY count DESC
    `;

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await sql`
      SELECT
        to_char(o.created_at, 'YYYY-MM') as month,
        SUM(o.amount) as revenue,
        COUNT(*)::int as orders_count
      FROM orders o
      WHERE o.status != 'cancelled'
      GROUP BY to_char(o.created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `;

    // Conversion rates: leads to clients
    const totalLeadsRows = await sql`
      SELECT COUNT(*)::int as count FROM leads l
      WHERE (${!hasDateFilter}::boolean OR
        (${useMonth}::boolean AND l.created_at >= NOW() - INTERVAL '1 month') OR
        (${useWeek}::boolean AND l.created_at >= NOW() - INTERVAL '7 days') OR
        (${useQuarter}::boolean AND l.created_at >= NOW() - INTERVAL '3 months') OR
        (${useYear}::boolean AND l.created_at >= NOW() - INTERVAL '1 year'))
    `;
    const totalLeads = totalLeadsRows[0] as { count: number };

    const convertedLeadsRows = await sql`
      SELECT COUNT(*)::int as count FROM leads l
      WHERE l.status = 'converted'
        AND (${!hasDateFilter}::boolean OR
          (${useMonth}::boolean AND l.created_at >= NOW() - INTERVAL '1 month') OR
          (${useWeek}::boolean AND l.created_at >= NOW() - INTERVAL '7 days') OR
          (${useQuarter}::boolean AND l.created_at >= NOW() - INTERVAL '3 months') OR
          (${useYear}::boolean AND l.created_at >= NOW() - INTERVAL '1 year'))
    `;
    const convertedLeads = convertedLeadsRows[0] as { count: number };

    const conversionRate = totalLeads.count > 0
      ? ((convertedLeads.count / totalLeads.count) * 100).toFixed(1)
      : '0';

    // Popular products
    const popularProducts = await sql`
      SELECT o.product_type, COUNT(*)::int as count, SUM(o.amount) as total_revenue
      FROM orders o
      WHERE o.status != 'cancelled'
        AND (${!hasDateFilter}::boolean OR
          (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
          (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days') OR
          (${useQuarter}::boolean AND o.created_at >= NOW() - INTERVAL '3 months') OR
          (${useYear}::boolean AND o.created_at >= NOW() - INTERVAL '1 year'))
      GROUP BY o.product_type
      ORDER BY count DESC
    `;

    // Average check
    const avgCheckRows = await sql`
      SELECT
        AVG(o.amount) as avg_check,
        SUM(o.amount) as total_revenue,
        COUNT(*)::int as total_orders
      FROM orders o
      WHERE o.status != 'cancelled' AND o.amount > 0
        AND (${!hasDateFilter}::boolean OR
          (${useMonth}::boolean AND o.created_at >= NOW() - INTERVAL '1 month') OR
          (${useWeek}::boolean AND o.created_at >= NOW() - INTERVAL '7 days') OR
          (${useQuarter}::boolean AND o.created_at >= NOW() - INTERVAL '3 months') OR
          (${useYear}::boolean AND o.created_at >= NOW() - INTERVAL '1 year'))
    `;
    const avgCheck = avgCheckRows[0] as { avg_check: number | null; total_revenue: number | null; total_orders: number };

    // Lead sources distribution
    const leadSources = await sql`
      SELECT l.source, COUNT(*)::int as count
      FROM leads l
      WHERE (${!hasDateFilter}::boolean OR
        (${useMonth}::boolean AND l.created_at >= NOW() - INTERVAL '1 month') OR
        (${useWeek}::boolean AND l.created_at >= NOW() - INTERVAL '7 days') OR
        (${useQuarter}::boolean AND l.created_at >= NOW() - INTERVAL '3 months') OR
        (${useYear}::boolean AND l.created_at >= NOW() - INTERVAL '1 year'))
      GROUP BY l.source
      ORDER BY count DESC
    `;

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
