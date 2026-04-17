import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) {
      return NextResponse.json({
        totalRevenue: 0, totalExpenses: 0, profit: 0,
        chartData: [], expensesByCategory: { deal: [], general: [] },
        debts: [], recentPayments: [], recentExpenses: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '1 month'";
    } else if (period === 'quarter') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '3 months'";
    } else if (period === 'year') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '1 year'";
    }

    // Total revenue (sum of payments)
    let revenueRows;
    if (period === 'month') {
      revenueRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 month'`;
    } else if (period === 'quarter') {
      revenueRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '3 months'`;
    } else if (period === 'year') {
      revenueRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 year'`;
    } else {
      revenueRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ${companyId}`;
    }
    const totalRevenue = Number(revenueRows[0].total);

    // Total deal expenses
    let dealExpRows;
    if (period === 'month') {
      dealExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM deal_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 month'`;
    } else if (period === 'quarter') {
      dealExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM deal_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '3 months'`;
    } else if (period === 'year') {
      dealExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM deal_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 year'`;
    } else {
      dealExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM deal_expenses WHERE company_id = ${companyId}`;
    }

    // Total general expenses
    let genExpRows;
    if (period === 'month') {
      genExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 month'`;
    } else if (period === 'quarter') {
      genExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '3 months'`;
    } else if (period === 'year') {
      genExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '1 year'`;
    } else {
      genExpRows = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE company_id = ${companyId}`;
    }

    const totalExpenses = Number(dealExpRows[0].total) + Number(genExpRows[0].total);
    const profit = totalRevenue - totalExpenses;

    // Revenue by month (last 6 months)
    const revenueByMonth = await sql`
      SELECT
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE company_id = ${companyId} AND payment_date >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
      ORDER BY month
    `;

    // Expenses by month (last 6 months) - combined
    const dealExpByMonth = await sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(amount), 0) as total
      FROM deal_expenses
      WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `;
    const genExpByMonth = await sql`
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        COALESCE(SUM(amount), 0) as total
      FROM general_expenses
      WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
      ORDER BY month
    `;

    // Merge into a single chart-friendly array
    const monthMap: Record<string, { revenue: number; expenses: number }> = {};
    for (const r of revenueByMonth) {
      const m = String(r.month);
      if (!monthMap[m]) monthMap[m] = { revenue: 0, expenses: 0 };
      monthMap[m].revenue = Number(r.total);
    }
    for (const r of dealExpByMonth) {
      const m = String(r.month);
      if (!monthMap[m]) monthMap[m] = { revenue: 0, expenses: 0 };
      monthMap[m].expenses += Number(r.total);
    }
    for (const r of genExpByMonth) {
      const m = String(r.month);
      if (!monthMap[m]) monthMap[m] = { revenue: 0, expenses: 0 };
      monthMap[m].expenses += Number(r.total);
    }

    const chartData = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        expenses: data.expenses,
      }));

    // Expenses by category
    const dealExpByCat = await sql`
      SELECT category, COALESCE(SUM(amount), 0) as total FROM deal_expenses WHERE company_id = ${companyId} GROUP BY category
    `;
    const genExpByCat = await sql`
      SELECT category, COALESCE(SUM(amount), 0) as total FROM general_expenses WHERE company_id = ${companyId} GROUP BY category
    `;

    // Outstanding debts: orders where amount > sum of payments
    const debts = await sql`
      SELECT
        o.id, o.amount, o.status,
        c.name as client_name, c.phone as client_phone,
        COALESCE(p.paid, 0) as paid,
        o.amount - COALESCE(p.paid, 0) as debt
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN (
        SELECT order_id, SUM(amount) as paid FROM payments WHERE company_id = ${companyId} GROUP BY order_id
      ) p ON p.order_id = o.id
      WHERE o.company_id = ${companyId}
        AND o.status NOT IN ('cancelled')
        AND o.amount > 0
        AND o.amount > COALESCE(p.paid, 0)
      ORDER BY debt DESC
      LIMIT 20
    `;

    // Recent payments
    const recentPayments = await sql`
      SELECT p.*, o.id as order_id, c.name as client_name
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE p.company_id = ${companyId}
      ORDER BY p.created_at DESC
      LIMIT 10
    `;

    // Recent expenses (both types combined)
    const recentDealExp = await sql`
      SELECT de.id, de.category, de.description, de.amount, de.created_at, 'deal' as type, de.order_id
      FROM deal_expenses de
      WHERE de.company_id = ${companyId}
      ORDER BY de.created_at DESC
      LIMIT 10
    `;
    const recentGenExp = await sql`
      SELECT ge.id, ge.category, ge.description, ge.amount, ge.created_at, 'general' as type, 0 as order_id
      FROM general_expenses ge
      WHERE ge.company_id = ${companyId}
      ORDER BY ge.created_at DESC
      LIMIT 10
    `;
    const recentExpenses = [...recentDealExp, ...recentGenExp]
      .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, 10);

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      profit,
      chartData,
      expensesByCategory: { deal: dealExpByCat, general: genExpByCat },
      debts,
      recentPayments,
      recentExpenses,
    });
  } catch (error) {
    console.error('Finance API error:', error);
    return NextResponse.json({ error: 'Failed to fetch finance data' }, { status: 500 });
  }
}
