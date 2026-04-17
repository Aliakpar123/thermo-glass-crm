import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';

export async function GET(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const category = searchParams.get('category') || '';

    let expenses;
    if (period === 'month' && category) {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '1 month' AND category = ${category} ORDER BY expense_date DESC`;
    } else if (period === 'month') {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '1 month' ORDER BY expense_date DESC`;
    } else if (period === 'quarter' && category) {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '3 months' AND category = ${category} ORDER BY expense_date DESC`;
    } else if (period === 'quarter') {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '3 months' ORDER BY expense_date DESC`;
    } else if (period === 'year' && category) {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '1 year' AND category = ${category} ORDER BY expense_date DESC`;
    } else if (period === 'year') {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '1 year' ORDER BY expense_date DESC`;
    } else if (category) {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} AND category = ${category} ORDER BY expense_date DESC`;
    } else {
      expenses = await sql`SELECT * FROM general_expenses WHERE company_id = ${companyId} ORDER BY expense_date DESC`;
    }

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching general expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = await getDb();
    const companyId = await getActiveCompanyId();
    if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

    const body = await request.json();
    const { category, description, amount, expense_date, created_by } = body;

    if (!category || !description || !amount) {
      return NextResponse.json({ error: 'Category, description and amount are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO general_expenses (category, description, amount, expense_date, created_by, company_id)
      VALUES (${category}, ${description}, ${Number(amount)}, ${expense_date || new Date().toISOString().split('T')[0]}, ${created_by || null}, ${companyId})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating general expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
