import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const sql = await getDb();
    const body = await request.json();
    const { prompt, type } = body; // type: 'instagram' | 'whatsapp' | 'faq' | 'reels' | 'custom'

    // Get CRM data for context
    const totalClients = await sql`SELECT COUNT(*)::int as count FROM clients`;
    const topCities = await sql`SELECT city, COUNT(*)::int as count FROM clients WHERE city != '' GROUP BY city ORDER BY count DESC LIMIT 5`;
    const topPains = await sql`SELECT client_pain as pain, COUNT(*)::int as count FROM orders WHERE client_pain != '' AND client_pain IS NOT NULL GROUP BY client_pain ORDER BY count DESC LIMIT 5`;
    const completedDeals = await sql`SELECT COUNT(*)::int as count FROM orders WHERE status = 'completed'`;

    const crmContext = `
Контекст компании Thermo Glass KZ:
- Продукт: стеклопакеты с электрообогревом (температура стекла +25°C)
- Страна: Казахстан
- Всего клиентов: ${totalClients[0]?.count || 0}
- Завершённых сделок: ${completedDeals[0]?.count || 0}
- Топ города: ${topCities.map((c: Record<string, unknown>) => `${c.city} (${c.count})`).join(', ')}
- Главные боли клиентов: холодные окна, проблемы с отоплением, конденсат, утепление балконов
- Преимущества: тепло в -30°C, экономия на отоплении до 40%, без конденсата, гарантия 5 лет
- Конкуренты: Стекломир (обычные энергосберегающие стеклопакеты)
`;

    const systemPrompts: Record<string, string> = {
      instagram: `Ты — маркетолог компании Thermo Glass KZ. Пиши посты для Instagram на русском языке. Используй эмодзи, хештеги, call-to-action. Пост должен быть продающим но не навязчивым. 150-300 слов. В конце добавь хештеги.`,
      whatsapp: `Ты — менеджер по продажам Thermo Glass KZ. Пиши сообщения для WhatsApp рассылки на русском языке. Короткий, личный, дружелюбный тон. 50-100 слов. С эмодзи.`,
      faq: `Ты — эксперт по стеклопакетам с электрообогревом. Напиши FAQ вопрос и подробный ответ для сайта компании Thermo Glass KZ. На русском языке. Профессиональный тон.`,
      reels: `Ты — контент-менеджер Thermo Glass KZ. Придумай идею для Reels/короткого видео для Instagram. Опиши: сценарий (10 секунд), текст на экране, музыку, хук в первые 3 секунды. На русском.`,
      custom: `Ты — маркетолог и помощник компании Thermo Glass KZ. Отвечай на русском языке. Помогай с маркетингом, контентом, продажами.`,
    };

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: (systemPrompts[type] || systemPrompts.custom) + '\n\n' + crmContext,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ text, type });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json({ error: 'AI generation failed: ' + String(error) }, { status: 500 });
  }
}
