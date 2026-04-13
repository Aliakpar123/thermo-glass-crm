import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = await getDb();
    const { id } = await params;

    const calcs = await sql`
      SELECT * FROM calculations
      WHERE order_id = ${Number(id)}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(calcs);
  } catch (error) {
    console.error('Error fetching calculations:', error);
    return NextResponse.json({ error: 'Failed to fetch calculations' }, { status: 500 });
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

    const {
      title,
      object_city,
      items_json,
      heating_type,
      required_power,
      multifunctional_glass,
      glass_color,
      room_type,
      room_area,
      total_area,
      quantity,
      created_by,
      created_by_name,
    } = body;

    const result = await sql`
      INSERT INTO calculations (
        order_id, title, object_city, items_json, heating_type,
        required_power, multifunctional_glass, glass_color, room_type,
        room_area, total_area, quantity, created_by, created_by_name
      ) VALUES (
        ${Number(id)},
        ${title || ''},
        ${object_city || ''},
        ${items_json || '[]'},
        ${heating_type || ''},
        ${Number(required_power) || 0},
        ${multifunctional_glass || ''},
        ${glass_color || ''},
        ${room_type || ''},
        ${Number(room_area) || 0},
        ${Number(total_area) || 0},
        ${Number(quantity) || 1},
        ${created_by ? Number(created_by) : null},
        ${created_by_name || ''}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating calculation:', error);
    return NextResponse.json({ error: 'Failed to create calculation' }, { status: 500 });
  }
}
