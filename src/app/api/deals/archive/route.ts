import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const deals = await sql`
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.city as client_city,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.archived_at)::int as days_archived
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.archived_at IS NOT NULL AND o.company_id = ${companyId}
      ORDER BY o.archived_at DESC
    `;
    return NextResponse.json(deals);
  } catch (error) {
    console.error('Error fetching archived deals:', error);
    return NextResponse.json({ error: 'Failed to fetch archive' }, { status: 500 });
  }
}
