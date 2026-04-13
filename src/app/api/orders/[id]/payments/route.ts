import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;
    const payments = await sql`
      SELECT * FROM payments WHERE order_id = ${Number(id)} ORDER BY payment_date DESC
    `;
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
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
    const { amount, payment_type, payment_date, notes, created_by } = body;

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO payments (order_id, amount, payment_type, payment_date, notes, created_by)
      VALUES (${Number(id)}, ${Number(amount)}, ${payment_type || 'transfer'}, ${payment_date || new Date().toISOString().split('T')[0]}, ${notes || ''}, ${created_by || null})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
