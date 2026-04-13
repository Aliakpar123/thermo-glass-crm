import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const expenses = await sql`
      SELECT * FROM deal_expenses WHERE order_id = ${Number(id)} ORDER BY created_at DESC
    `;
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching deal expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const body = await request.json();
    const { category, description, amount, created_by } = body;

    if (!category || !amount) {
      return NextResponse.json({ error: 'Category and amount are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO deal_expenses (order_id, category, description, amount, created_by)
      VALUES (${Number(id)}, ${category}, ${description || ''}, ${Number(amount)}, ${created_by || null})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating deal expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
