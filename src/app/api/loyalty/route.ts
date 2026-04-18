import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

// Пороги посещаемости (в днях) — подогнано под кофейню
const ACTIVE_DAYS = 14;       // был в последние 14 дней → активный
const AT_RISK_DAYS = 30;      // 14..30 дней → в зоне риска
// >30 дней без визита → потерян

type Row = {
  id: number;
  name: string;
  phone: string;
  city: string;
  manager_name: string | null;
  visits_count: number;
  first_visit: string | null;
  last_visit: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
};

export async function GET(_request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ clients: [], summary: emptySummary() });

    const rows = (await sql`
      SELECT
        c.id, c.name, c.phone, c.city,
        u.name as manager_name,
        COALESCE(v.visits_count, 0) as visits_count,
        v.first_visit,
        v.last_visit,
        CASE WHEN v.last_visit IS NULL THEN NULL
             ELSE EXTRACT(DAY FROM (NOW() - v.last_visit))::int
        END as days_since_last,
        CASE WHEN COALESCE(v.visits_count, 0) < 2 THEN NULL
             ELSE ROUND(EXTRACT(EPOCH FROM (v.last_visit - v.first_visit)) / 86400.0 / (v.visits_count - 1))::int
        END as avg_interval_days
      FROM clients c
      LEFT JOIN users u ON u.id = c.assigned_manager_id
      LEFT JOIN (
        SELECT client_id,
          COUNT(*)::int as visits_count,
          MIN(visited_at) as first_visit,
          MAX(visited_at) as last_visit
        FROM client_visits
        WHERE company_id = ${companyId}
        GROUP BY client_id
      ) v ON v.client_id = c.id
      WHERE c.company_id = ${companyId}
      ORDER BY v.last_visit DESC NULLS LAST, c.name ASC
    `) as unknown as Row[];

    const clients = rows.map((r) => ({
      ...r,
      status: classify(r.days_since_last, r.visits_count),
    }));

    // Метрики текущего календарного месяца
    const monthMetrics = (await sql`
      WITH this_month AS (
        SELECT DISTINCT client_id
        FROM client_visits
        WHERE company_id = ${companyId}
          AND visited_at >= date_trunc('month', NOW())
      ),
      first_visits AS (
        SELECT client_id, MIN(visited_at) as first_visit
        FROM client_visits
        WHERE company_id = ${companyId}
        GROUP BY client_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM client_visits
          WHERE company_id = ${companyId}
            AND visited_at >= date_trunc('month', NOW())) as visits_this_month,
        (SELECT COUNT(*)::int FROM this_month) as visitors_this_month,
        (SELECT COUNT(*)::int FROM first_visits
          WHERE first_visit >= date_trunc('month', NOW())) as new_this_month
    `) as unknown as { visits_this_month: number; visitors_this_month: number; new_this_month: number }[];

    const m = monthMetrics[0] || { visits_this_month: 0, visitors_this_month: 0, new_this_month: 0 };
    const returning_this_month = Math.max(0, m.visitors_this_month - m.new_this_month);
    const return_rate = m.visitors_this_month > 0
      ? +((returning_this_month / m.visitors_this_month) * 100).toFixed(1)
      : 0;

    const summary = {
      total_clients: clients.length,
      total_visits: clients.reduce((s, c) => s + (c.visits_count || 0), 0),
      with_visits: clients.filter((c) => c.visits_count > 0).length,
      active: clients.filter((c) => c.status === 'active').length,
      at_risk: clients.filter((c) => c.status === 'at_risk').length,
      lost: clients.filter((c) => c.status === 'lost').length,
      never: clients.filter((c) => c.status === 'never').length,
      avg_visits_per_client: clients.length
        ? +(clients.reduce((s, c) => s + (c.visits_count || 0), 0) / clients.length).toFixed(2)
        : 0,
      // Кофейные метрики за текущий месяц
      visits_this_month: m.visits_this_month,
      visitors_this_month: m.visitors_this_month,
      new_this_month: m.new_this_month,
      returning_this_month,
      return_rate,
      thresholds: { active_days: ACTIVE_DAYS, at_risk_days: AT_RISK_DAYS },
    };

    // помесячный ряд посещений (последние 12 месяцев)
    const monthly = (await sql`
      SELECT to_char(date_trunc('month', visited_at), 'YYYY-MM') as month,
             COUNT(*)::int as visits,
             COUNT(DISTINCT client_id)::int as unique_clients
      FROM client_visits
      WHERE company_id = ${companyId}
        AND visited_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1 ASC
    `) as unknown as { month: string; visits: number; unique_clients: number }[];

    return NextResponse.json({ clients, summary, monthly });
  } catch (error) {
    console.error('Error fetching loyalty stats:', error);
    return NextResponse.json({ error: 'Failed to fetch loyalty stats' }, { status: 500 });
  }
}

function classify(daysSinceLast: number | null, visits: number): 'active' | 'at_risk' | 'lost' | 'never' {
  if (!visits || daysSinceLast === null) return 'never';
  if (daysSinceLast <= ACTIVE_DAYS) return 'active';
  if (daysSinceLast <= AT_RISK_DAYS) return 'at_risk';
  return 'lost';
}

function emptySummary() {
  return {
    total_clients: 0,
    total_visits: 0,
    with_visits: 0,
    active: 0,
    at_risk: 0,
    lost: 0,
    never: 0,
    avg_visits_per_client: 0,
    visits_this_month: 0,
    visitors_this_month: 0,
    new_this_month: 0,
    returning_this_month: 0,
    return_rate: 0,
    thresholds: { active_days: ACTIVE_DAYS, at_risk_days: AT_RISK_DAYS },
  };
}
