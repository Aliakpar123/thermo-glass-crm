import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const sql = await getDb();

    // Pain categories stats
    const painStats = await sql`
      SELECT client_pain as category, COUNT(*) as count
      FROM orders WHERE client_pain != '' AND client_pain IS NOT NULL
      GROUP BY client_pain ORDER BY count DESC
    `;

    // Pains by city
    const painsByCity = await sql`
      SELECT c.city, o.client_pain as category, COUNT(*) as count
      FROM orders o LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.client_pain != '' AND o.client_pain IS NOT NULL AND c.city != ''
      GROUP BY c.city, o.client_pain ORDER BY count DESC
    `;

    // Pains by room type
    const painsByRoom = await sql`
      SELECT o.room_type, o.client_pain as category, COUNT(*) as count
      FROM orders o
      WHERE o.client_pain != '' AND o.client_pain IS NOT NULL AND o.room_type != ''
      GROUP BY o.room_type, o.client_pain ORDER BY count DESC
    `;

    // Segments: city stats
    const segments = await sql`
      SELECT c.city, COUNT(*) as client_count,
        COALESCE(AVG(o.amount),0)::numeric as avg_check,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int as completed
      FROM clients c LEFT JOIN orders o ON o.client_id = c.id
      WHERE c.city != ''
      GROUP BY c.city ORDER BY client_count DESC LIMIT 10
    `;

    // Objections (from loss reasons)
    const objections = await sql`
      SELECT loss_reason as reason, COUNT(*) as count
      FROM orders WHERE status = 'cancelled' AND loss_reason != ''
      GROUP BY loss_reason ORDER BY count DESC
    `;

    const leadObjections = await sql`
      SELECT loss_reason as reason, COUNT(*) as count
      FROM leads WHERE status = 'lost' AND loss_reason != ''
      GROUP BY loss_reason ORDER BY count DESC
    `;

    return NextResponse.json({
      pain_stats: painStats,
      pains_by_city: painsByCity,
      pains_by_room: painsByRoom,
      segments,
      objections: [...objections, ...leadObjections],
    });
  } catch (error) {
    console.error('Error fetching wiki data:', error);
    return NextResponse.json({ error: 'Failed to fetch wiki data' }, { status: 500 });
  }
}
