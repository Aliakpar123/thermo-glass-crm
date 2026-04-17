import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  const sql = await getDb();
  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get('manager_id') || '';

  let notifications;
  if (managerId) {
    notifications = await sql`
      SELECT o.id, o.next_action_date, o.next_action_text, o.status,
        c.name as client_name, c.phone as client_phone,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.next_action_date)::int as days_overdue
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.company_id = ${companyId}
        AND o.next_action_date IS NOT NULL
        AND o.status NOT IN ('completed', 'cancelled')
        AND o.manager_id = ${Number(managerId)}
        AND o.next_action_date <= NOW() + INTERVAL '1 day'
      ORDER BY o.next_action_date ASC
    `;
  } else {
    notifications = await sql`
      SELECT o.id, o.next_action_date, o.next_action_text, o.status,
        c.name as client_name, c.phone as client_phone,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.next_action_date)::int as days_overdue
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.company_id = ${companyId}
        AND o.next_action_date IS NOT NULL
        AND o.status NOT IN ('completed', 'cancelled')
        AND o.next_action_date <= NOW() + INTERVAL '1 day'
      ORDER BY o.next_action_date ASC
    `;
  }

  return NextResponse.json(notifications);
}
