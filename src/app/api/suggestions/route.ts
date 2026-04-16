import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

interface Suggestion {
  deal_id: number;
  client_name: string;
  client_phone: string;
  type: 'call' | 'whatsapp' | 'followup' | 'discount' | 'urgency' | 'upsell';
  priority: 'high' | 'medium' | 'low';
  message: string;
  action_text: string;
  reason: string;
}

export async function GET(request: NextRequest) {
  const sql = await getDb();
  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get('manager_id') || '';

  let deals;
  if (managerId) {
    deals = await sql`
      SELECT o.id, o.status, o.amount, o.client_pain, o.updated_at, o.next_action_date, o.next_action_text,
        o.manager_id, c.name as client_name, c.phone as client_phone, c.city as client_city, c.source as client_source,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_inactive
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.status NOT IN ('completed', 'cancelled')
        AND o.manager_id = ${Number(managerId)}
      ORDER BY o.updated_at ASC
    `;
  } else {
    deals = await sql`
      SELECT o.id, o.status, o.amount, o.client_pain, o.updated_at, o.next_action_date, o.next_action_text,
        o.manager_id, c.name as client_name, c.phone as client_phone, c.city as client_city, c.source as client_source,
        u.name as manager_name,
        EXTRACT(DAY FROM NOW() - o.updated_at)::int as days_inactive
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.status NOT IN ('completed', 'cancelled')
      ORDER BY o.updated_at ASC
    `;
  }

  const suggestions: Suggestion[] = [];

  for (const deal of deals) {
    const daysInactive = deal.days_inactive || 0;
    const phone = deal.client_phone?.replace(/\D/g, '') || '';

    // Rule 1: No contact for 3+ days (but less than 7)
    if (daysInactive >= 3 && daysInactive < 7) {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'whatsapp',
        priority: 'high',
        message: `${deal.client_name} \u2014 ${daysInactive} \u0434\u043d\u0435\u0439 \u0431\u0435\u0437 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430`,
        action_text: `\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, ${deal.client_name}! \uD83D\uDC4B\n\u041c\u044b \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u043b\u0438 \u0434\u043b\u044f \u0432\u0430\u0441 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e \u043f\u043e ${deal.client_pain === 'heating' ? '\u043e\u0442\u043e\u043f\u043b\u0435\u043d\u0438\u044e' : deal.client_pain === 'cold_windows' ? '\u0443\u0442\u0435\u043f\u043b\u0435\u043d\u0438\u044e \u043e\u043a\u043e\u043d' : '\u0432\u0430\u0448\u0435\u043c\u0443 \u0437\u0430\u043f\u0440\u043e\u0441\u0443'}.\n\u041a\u043e\u0433\u0434\u0430 \u0443\u0434\u043e\u0431\u043d\u043e \u043e\u0431\u0441\u0443\u0434\u0438\u0442\u044c?`,
        reason: `${daysInactive} \u0434\u043d\u0435\u0439 \u0431\u0435\u0437 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438`,
      });
    }

    // Rule 2: No contact for 7+ days — offer discount
    if (daysInactive >= 7) {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'discount',
        priority: 'high',
        message: `\u26A0\uFE0F ${deal.client_name} \u2014 ${daysInactive} \u0434\u043d\u0435\u0439! \u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443?`,
        action_text: `${deal.client_name}, \u0437\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!\n\u041c\u044b \u0445\u043e\u0442\u0438\u043c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0438\u0442\u044c \u0432\u0430\u043c \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u2014 \u0441\u043a\u0438\u0434\u043a\u0443 10% \u043d\u0430 \u0441\u0442\u0435\u043a\u043b\u043e\u043f\u0430\u043a\u0435\u0442\u044b \u0441 \u043e\u0431\u043e\u0433\u0440\u0435\u0432\u043e\u043c.\n\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u043e \u043a\u043e\u043d\u0446\u0430 \u043d\u0435\u0434\u0435\u043b\u0438.\n\u0418\u043d\u0442\u0435\u0440\u0435\u0441\u043d\u043e? \uD83D\uDE0A`,
        reason: `${daysInactive} \u0434\u043d\u0435\u0439 \u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0442\u0430 \u2014 \u043a\u043b\u0438\u0435\u043d\u0442 \u043e\u0441\u0442\u044b\u0432\u0430\u0435\u0442`,
      });
    }

    // Rule 3: Deal stuck in same status for 5+ days
    if (daysInactive >= 5 && ['contacted', 'measurement', 'calculation'].includes(deal.status)) {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'followup',
        priority: 'medium',
        message: `${deal.client_name} \u0437\u0430\u0441\u0442\u0440\u044f\u043b \u0432 "${deal.status}" ${daysInactive} \u0434\u043d\u0435\u0439`,
        action_text: `${deal.client_name}, \u0434\u043e\u0431\u0440\u044b\u0439 \u0434\u0435\u043d\u044c!\n\u0425\u043e\u0442\u0435\u043b \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u044c \u2014 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043b\u0438 \u0432\u0430\u043c \u043e\u0437\u043d\u0430\u043a\u043e\u043c\u0438\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u0448\u0438\u043c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435\u043c?\n\u0415\u0441\u043b\u0438 \u0435\u0441\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441\u044b, \u0441 \u0443\u0434\u043e\u0432\u043e\u043b\u044c\u0441\u0442\u0432\u0438\u0435\u043c \u043e\u0442\u0432\u0435\u0447\u0443! \uD83D\uDE42`,
        reason: `\u0421\u0434\u0435\u043b\u043a\u0430 \u043d\u0435 \u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044f ${daysInactive} \u0434\u043d\u0435\u0439`,
      });
    }

    // Rule 4: New deal — call immediately
    if (deal.status === 'new' && daysInactive >= 0) {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'call',
        priority: 'high',
        message: `\uD83C\uDD95 ${deal.client_name} \u2014 \u043d\u043e\u0432\u044b\u0439! \u041f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u0435 \u043f\u0440\u044f\u043c\u043e \u0441\u0435\u0439\u0447\u0430\u0441`,
        action_text: `\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, ${deal.client_name}! \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0447\u0442\u043e \u043e\u0431\u0440\u0430\u0442\u0438\u043b\u0438\u0441\u044c \u0432 Thermo Glass! \uD83D\uDE4F\n\u041c\u0435\u043d\u044f \u0437\u043e\u0432\u0443\u0442 \u041a\u0430\u043c\u0438\u043b\u043b\u0430, \u044f \u0432\u0430\u0448 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440.\n\u0420\u0430\u0441\u0441\u043a\u0430\u0436\u0438\u0442\u0435, \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0447\u0442\u043e \u0431\u044b \u0432\u044b \u0445\u043e\u0442\u0435\u043b\u0438?`,
        reason: '\u041d\u043e\u0432\u044b\u0439 \u043a\u043e\u043d\u0442\u0430\u043a\u0442 \u2014 \u0431\u044b\u0441\u0442\u0440\u044b\u0439 \u043e\u0442\u043a\u043b\u0438\u043a \u0443\u0432\u0435\u043b\u0438\u0447\u0438\u0432\u0430\u0435\u0442 \u043a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044e \u043d\u0430 80%',
      });
    }

    // Rule 5: Approved but not paid for 3+ days
    if (deal.status === 'approved' && daysInactive >= 3) {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'urgency',
        priority: 'medium',
        message: `${deal.client_name} \u2014 \u0441\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d, \u043d\u043e \u043d\u0435 \u043e\u043f\u043b\u0430\u0447\u0435\u043d ${daysInactive} \u0434\u043d.`,
        action_text: `${deal.client_name}, \u0437\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!\n\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u044e, \u0447\u0442\u043e \u0432\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u0441\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d \u0438 \u0433\u043e\u0442\u043e\u0432 \u043a \u0437\u0430\u043f\u0443\u0441\u043a\u0443 \u0432 \u043f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0441\u0442\u0432\u043e.\n\u0421\u0440\u043e\u043a\u0438 \u0438\u0437\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u2014 2-3 \u043d\u0435\u0434\u0435\u043b\u0438. \u0427\u0435\u043c \u0440\u0430\u043d\u044c\u0448\u0435 \u043e\u043f\u043b\u0430\u0442\u0438\u0442\u0435, \u0442\u0435\u043c \u0431\u044b\u0441\u0442\u0440\u0435\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435! \uD83D\uDE80`,
        reason: '\u0421\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u0430\u043d \u043d\u043e \u043d\u0435 \u043e\u043f\u043b\u0430\u0447\u0435\u043d \u2014 \u043d\u0443\u0436\u0435\u043d push',
      });
    }

    // Rule 6: High amount deal — upsell
    if (Number(deal.amount) > 500000 && deal.status === 'paid') {
      suggestions.push({
        deal_id: deal.id,
        client_name: deal.client_name,
        client_phone: phone,
        type: 'upsell',
        priority: 'low',
        message: `\uD83D\uDCB0 ${deal.client_name} \u2014 VIP \u043a\u043b\u0438\u0435\u043d\u0442. \u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0438\u0442\u044c \u0434\u043e\u043f. \u0443\u0441\u043b\u0443\u0433\u0438?`,
        action_text: `${deal.client_name}, \u0441\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0437\u0430\u043a\u0430\u0437! \uD83C\uDF89\n\u041a\u0441\u0442\u0430\u0442\u0438, \u0434\u043b\u044f \u043d\u0430\u0448\u0438\u0445 VIP \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043c\u044b \u043f\u0440\u0435\u0434\u043b\u0430\u0433\u0430\u0435\u043c \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e\u0435 \u043e\u0431\u0441\u043b\u0443\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u043d\u0430 1 \u0433\u043e\u0434.\n\u0422\u0430\u043a\u0436\u0435 \u043c\u043e\u0436\u0435\u043c \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044c \u043e\u0431\u043e\u0433\u0440\u0435\u0432 \u0434\u043b\u044f \u0434\u0440\u0443\u0433\u0438\u0445 \u043a\u043e\u043c\u043d\u0430\u0442 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439 15%.`,
        reason: '\u041a\u0440\u0443\u043f\u043d\u044b\u0439 \u043a\u043b\u0438\u0435\u043d\u0442 \u2014 \u043f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b \u0434\u043b\u044f \u0434\u043e\u043f\u0440\u043e\u0434\u0430\u0436',
      });
    }
  }

  // Sort: high priority first, then by days inactive
  const prioMap: Record<string, number> = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => {
    return (prioMap[a.priority] || 0) - (prioMap[b.priority] || 0);
  });

  return NextResponse.json(suggestions.slice(0, 20));
}
