import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

const PAIN_LABELS: Record<string, string> = {
  heating: 'Отопление / нет отопления',
  cold_windows: 'Холодные окна / промерзание',
  condensation: 'Конденсат на стёклах',
  high_heating: 'Высокие счета за отопление',
  noise: 'Шум с улицы',
  old_windows: 'Старые окна, нужна замена',
  balcony: 'Утепление балкона/лоджии',
  design: 'Дизайн / панорамное остекление',
  energy: 'Энергоэффективность',
  safety: 'Безопасность (дети, взлом)',
  other: 'Другое',
};

const PAIN_TEMPLATES: Record<string, { instagram: string; whatsapp: string; faq_q: string; faq_a: string; reels: string }> = {
  heating: {
    instagram: `🔥 {count} клиентов в {top_city} уже решили проблему отопления!\n\nСтеклопакеты с электрообогревом — это:\n✅ Температура стекла +25°C\n✅ Экономия на отоплении до 40%\n✅ Никакого конденсата\n\n📩 Напишите нам для бесплатной консультации\n\n#отопление #астана #thermoglass #теплыеокна`,
    whatsapp: `Здравствуйте! 👋\n\nМы — Thermo Glass KZ, производим стеклопакеты с электрообогревом.\n\n🔥 Решаем проблему отопления:\n• Температура стекла +25°C зимой\n• Экономия на отоплении до 40%\n• Гарантия 5 лет\n\nУже {count} клиентов в {top_city} выбрали нас.\n\nХотите узнать стоимость для вашего объекта?`,
    faq_q: 'Можно ли использовать стеклопакеты с обогревом как основное отопление?',
    faq_a: 'Да! Наши стеклопакеты с электрообогревом могут полностью заменить традиционные радиаторы. Температура поверхности стекла достигает +25°C, что обеспечивает комфортное тепло в помещении.',
    reels: '🎬 Идея для Reels: "Зима в Астане. -30 на улице. А у наших клиентов стёкла тёплые +25°C. Покажите тепловизор до/после установки"',
  },
  cold_windows: {
    instagram: `❄️ Устали мёрзнуть зимой?\n\n{count} клиентов из {top_city} уже забыли что такое холодные окна!\n\n5 причин почему обычные окна не спасают:\n1️⃣ Нет обогрева стекла\n2️⃣ Конденсат и плесень\n3️⃣ Сквозняки\n4️⃣ Промерзание рам\n5️⃣ Потеря тепла до 40%\n\n💡 Решение — стеклопакеты с электрообогревом Thermo Glass\n\n#холодныеокна #thermoglass #астана`,
    whatsapp: `Здравствуйте! 👋\n\nВас беспокоят холодные окна зимой?\n\nМы решаем эту проблему раз и навсегда:\n❄️→🔥 Стеклопакеты с электрообогревом\n\n• Стекло тёплое даже в -30°C\n• Никакого конденсата\n• Установка за 1 день\n\n{count} клиентов в {top_city} уже довольны.\n\nОтправить расчёт стоимости?`,
    faq_q: 'Почему окна промерзают зимой и как это решить?',
    faq_a: 'Окна промерзают из-за большой разницы температур. Обычные стеклопакеты не могут обогревать себя. Стеклопакеты Thermo Glass имеют встроенный электрообогрев — стекло всегда тёплое (+25°C), конденсат и промерзание исключены.',
    reels: '🎬 Идея для Reels: "Эксперимент: обычное окно vs Thermo Glass в -30°C. Положите лёд на стекло — у нас тает за 10 секунд!"',
  },
  condensation: {
    instagram: `💧 Конденсат на окнах = плесень и грибок!\n\n{count} клиентов уже избавились от этой проблемы.\n\nПочему конденсат появляется:\n• Холодное стекло\n• Высокая влажность\n• Плохая вентиляция\n\n✅ Наше решение: стекло с обогревом. Поверхность всегда тёплая — конденсату негде образоваться!\n\n#конденсат #плесень #thermoglass`,
    whatsapp: `Конденсат на окнах? 💧\n\nЭто не просто вода — это плесень и грибок!\n\nРешение: стеклопакеты с обогревом от Thermo Glass\n✅ Стекло тёплое = конденсат невозможен\n✅ Здоровый микроклимат\n\nРассчитать стоимость?`,
    faq_q: 'Как избавиться от конденсата на окнах?',
    faq_a: 'Конденсат образуется когда холодное стекло контактирует с тёплым влажным воздухом. Стеклопакеты Thermo Glass с электрообогревом поддерживают температуру стекла +25°C — конденсат физически не может образоваться.',
    reels: '🎬 Идея: "Утро зимой. У соседей — конденсат и лужи. У нас — сухие тёплые окна. Чувствуешь разницу?"',
  },
  high_heating: {
    instagram: `💸 Счета за отопление бьют рекорды?\n\n{count} наших клиентов экономят до 40% на отоплении!\n\nКак это работает:\n1. Стеклопакет обогревает себя сам\n2. Тепло не уходит через окна\n3. Меньше нагрузка на котёл\n\nОкупается за 2-3 отопительных сезона 📊\n\n#экономия #отопление #thermoglass`,
    whatsapp: `Устали от высоких счетов за отопление? 💸\n\nНаши клиенты экономят до 40%!\n\nСтеклопакеты с обогревом:\n• Окна не теряют тепло\n• Меньше расход газа/электричества\n• Окупаемость 2-3 сезона\n\nПосчитать экономию для вашего дома?`,
    faq_q: 'Сколько можно сэкономить на отоплении с вашими окнами?',
    faq_a: 'В среднем наши клиенты экономят 30-40% на отоплении. Стеклопакеты с электрообогревом не пропускают холод снаружи и сохраняют тепло внутри. Окупаемость — 2-3 отопительных сезона.',
    reels: '🎬 Идея: "Показываем счета за отопление ДО и ПОСЛЕ установки Thermo Glass. Разница — 40%!"',
  },
  balcony: {
    instagram: `🏠 Балкон — это ещё одна комната!\n\n{count} клиентов в {top_city} уже превратили балкон в тёплое пространство.\n\nЧто получаете:\n✅ Тёплый балкон даже в -30°C\n✅ Дополнительная комната\n✅ Увеличение площади квартиры\n✅ Без радиаторов и труб\n\n#балкон #утепление #thermoglass #астана`,
    whatsapp: `Хотите тёплый балкон? 🏠\n\nСтеклопакеты с обогревом:\n• Балкон = тёплая комната\n• Даже в -30°C\n• Без батарей и труб\n\nУже {count} клиентов оценили!\n\nРассчитать стоимость остекления?`,
    faq_q: 'Можно ли утеплить балкон стеклопакетами с обогревом?',
    faq_a: 'Да! Наши стеклопакеты превращают балкон в полноценную тёплую комнату. Встроенный обогрев поддерживает +25°C на стекле — не нужны дополнительные радиаторы.',
    reels: '🎬 Идея: "Балкон БЫЛО: склад хлама. СТАЛО: уютный кабинет с видом на город. Thermo Glass сделал это возможным"',
  },
};

const DEFAULT_TEMPLATE = {
  instagram: `🏢 Thermo Glass KZ — стеклопакеты с электрообогревом\n\nУже {total_clients} клиентов доверяют нам!\n\n✅ Тёплые окна в любой мороз\n✅ Без конденсата\n✅ Экономия на отоплении\n\n📩 Бесплатная консультация\n\n#thermoglass #астана #окна`,
  whatsapp: `Здравствуйте! 👋\nМы — Thermo Glass KZ.\n\nПроизводим стеклопакеты с электрообогревом.\nУже {total_clients} клиентов выбрали нас.\n\nХотите узнать подробнее?`,
  faq_q: 'Что такое стеклопакеты с электрообогревом?',
  faq_a: 'Это стеклопакеты со встроенным нагревательным элементом. Стекло всегда тёплое (+25°C), что исключает конденсат, промерзание и потерю тепла.',
  reels: '🎬 Идея: "3 причины выбрать Thermo Glass: тепло, экономия, красота"',
};

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export async function GET() {
  try {
    const sql = await getDb();

    // Get pain stats (expand comma-separated)
    const rawPains = await sql`
      SELECT client_pain as pain, COUNT(*)::int as count
      FROM orders WHERE client_pain != '' AND client_pain IS NOT NULL
      GROUP BY client_pain ORDER BY count DESC LIMIT 20
    `;

    // Expand comma-separated pains
    const painMap: Record<string, number> = {};
    for (const row of rawPains) {
      const cats = String(row.pain).split(',').filter(Boolean);
      for (const c of cats) {
        painMap[c.trim()] = (painMap[c.trim()] || 0) + Number(row.count);
      }
    }
    const pains = Object.entries(painMap)
      .map(([pain, count]) => ({ pain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get city stats
    const cities = await sql`
      SELECT c.city, COUNT(*)::int as count
      FROM clients c WHERE c.city != ''
      GROUP BY c.city ORDER BY count DESC LIMIT 5
    `;

    // Get product stats
    const products = await sql`
      SELECT product_type, COUNT(*)::int as count
      FROM orders WHERE product_type != ''
      GROUP BY product_type ORDER BY count DESC LIMIT 5
    `;

    // Get loss reasons
    const losses = await sql`
      SELECT loss_reason as reason, COUNT(*)::int as count
      FROM orders WHERE status = 'cancelled' AND loss_reason != '' AND loss_reason IS NOT NULL
      GROUP BY loss_reason ORDER BY count DESC LIMIT 5
    `;

    // Get total stats
    const totalClientsRes = await sql`SELECT COUNT(*)::int as count FROM clients`;
    const totalDealsRes = await sql`SELECT COUNT(*)::int as count FROM orders`;
    const completedDealsRes = await sql`SELECT COUNT(*)::int as count FROM orders WHERE status = 'completed'`;

    const totalClients = Number(totalClientsRes[0]?.count || 0);
    const totalDeals = Number(totalDealsRes[0]?.count || 0);
    const completedDeals = Number(completedDealsRes[0]?.count || 0);
    const topCity = cities.length > 0 ? String(cities[0].city) : 'Астана';

    // Generate content for each pain
    const contentByPain = pains.map((p) => {
      const template = PAIN_TEMPLATES[p.pain] || DEFAULT_TEMPLATE;
      const vars = {
        count: p.count,
        top_city: topCity,
        total_clients: totalClients,
      };

      return {
        pain: p.pain,
        pain_label: PAIN_LABELS[p.pain] || p.pain,
        count: p.count,
        instagram: fillTemplate(template.instagram, vars),
        whatsapp: fillTemplate(template.whatsapp, vars),
        faq_q: template.faq_q,
        faq_a: template.faq_a,
        reels: template.reels,
      };
    });

    // General content
    const generalVars = { total_clients: totalClients, top_city: topCity, count: totalClients };
    const generalContent = {
      instagram: fillTemplate(DEFAULT_TEMPLATE.instagram, generalVars),
      whatsapp: fillTemplate(DEFAULT_TEMPLATE.whatsapp, generalVars),
      faq_q: DEFAULT_TEMPLATE.faq_q,
      faq_a: DEFAULT_TEMPLATE.faq_a,
      reels: DEFAULT_TEMPLATE.reels,
    };

    const tips = [
      'Лучшее время для постов: 12:00-14:00 и 19:00-21:00',
      'Используйте тепловизорные фото — конверсия выше на 40%',
      'Видео-отзывы клиентов работают лучше текстовых',
      'Посты с цифрами получают в 2 раза больше вовлечения',
      'Сторис каждый день — показывайте процесс монтажа',
      'Отвечайте на комментарии в течение 1 часа',
      'Используйте геолокацию в постах для локального охвата',
      'Публикуйте кейсы клиентов с разрешения — доверие растёт',
    ];

    const weeklyPlan = [
      { day: 'Понедельник', type: 'Пост', topic: 'Кейс клиента с фото до/после' },
      { day: 'Вторник', type: 'Сторис', topic: 'Процесс производства на заводе' },
      { day: 'Среда', type: 'Reels', topic: 'Эксперимент: обычное окно vs Thermo Glass' },
      { day: 'Четверг', type: 'Пост', topic: 'FAQ: ответы на частые вопросы клиентов' },
      { day: 'Пятница', type: 'Сторис', topic: 'Монтаж у клиента — в реальном времени' },
      { day: 'Суббота', type: 'Reels', topic: 'Отзыв довольного клиента' },
      { day: 'Воскресенье', type: 'Отдых', topic: 'Планирование контента на неделю' },
    ];

    return NextResponse.json({
      stats: {
        total_clients: totalClients,
        total_deals: totalDeals,
        completed: completedDeals,
        top_city: topCity,
      },
      content_by_pain: contentByPain,
      general_content: generalContent,
      tips,
      weekly_plan: weeklyPlan,
    });
  } catch (error) {
    console.error('Marketing content API error:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}
