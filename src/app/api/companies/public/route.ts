import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

// GET /api/companies/public — публичный список компаний холдинга (без авторизации).
// Нужен для страницы E1eventy /select-company, где ещё нет логина.
export async function GET() {
  try {
    const sql = await getDb();
    const rows = await sql`
      SELECT id, name, slug, logo_emoji, color, description
      FROM companies
      ORDER BY name ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error listing public companies:', error);
    return NextResponse.json([], { status: 200 });
  }
}
