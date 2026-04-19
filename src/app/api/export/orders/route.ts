import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = await getActiveCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: 'No active company' }, { status: 403 });
    }

    const sql = await getDb();
    const rows = await sql`
      SELECT o.id, c.name as client_name, o.product_type, o.amount, o.status, o.created_at
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.company_id = ${companyId}
      ORDER BY o.created_at DESC
    `;

    const header = 'ID,Клиент,Тип продукта,Сумма,Статус,Дата создания';
    const csvRows = rows.map((r: Record<string, unknown>) => {
      const escape = (val: unknown) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      return [
        escape(r.id),
        escape(r.client_name),
        escape(r.product_type),
        escape(r.amount),
        escape(r.status),
        escape(r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU') : ''),
      ].join(',');
    });

    const csv = '\uFEFF' + [header, ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=orders.csv',
      },
    });
  } catch (error) {
    console.error('Error exporting orders:', error);
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
  }
}
