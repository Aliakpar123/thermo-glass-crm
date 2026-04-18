import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ count: 0 });

    const sql = await getDb();
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM whatsapp_messages
      WHERE company_id = ${companyId} AND direction = 'in' AND is_read = false
    `;
    return NextResponse.json({ count: Number(rows[0]?.count || 0) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
