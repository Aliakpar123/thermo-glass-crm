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
      SELECT name, phone, email, city, source, notes, created_at
      FROM clients
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
    `;

    const header = 'Имя,Телефон,Email,Город,Источник,Заметки,Дата создания';
    const csvRows = rows.map((r: Record<string, unknown>) => {
      const escape = (val: unknown) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      return [
        escape(r.name),
        escape(r.phone),
        escape(r.email),
        escape(r.city),
        escape(r.source),
        escape(r.notes),
        escape(r.created_at ? new Date(r.created_at as string).toLocaleDateString('ru-RU') : ''),
      ].join(',');
    });

    const csv = '\uFEFF' + [header, ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=clients.csv',
      },
    });
  } catch (error) {
    console.error('Error exporting clients:', error);
    return NextResponse.json({ error: 'Failed to export clients' }, { status: 500 });
  }
}
