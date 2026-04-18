/* Демо-рендер страницы /loyalty с моком данных (без авторизации и БД).
   Нужен только чтобы показать готовый вид при пустой dev-среде. */
'use client';

import { useMemo, useState } from 'react';

type VisitStatus = 'active' | 'at_risk' | 'lost' | 'never';

const STATUS_LABELS: Record<VisitStatus, string> = {
  active: 'Активные',
  at_risk: 'В зоне риска',
  lost: 'Потерянные',
  never: 'Без визитов',
};

const STATUS_COLORS: Record<VisitStatus, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  at_risk: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  lost: 'bg-red-500/15 text-red-400 border-red-500/30',
  never: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const clients = [
  { id: 1, name: 'Алия Жумабаева',     phone: '+7 701 234 5678', city: 'Алматы', visits_count: 18, first_visit: '2025-11-02', last_visit: '2026-04-17', avg_interval_days: 9,  days_since_last: 1,   status: 'active'  as VisitStatus },
  { id: 2, name: 'Руслан Ким',         phone: '+7 727 555 1212', city: 'Алматы', visits_count: 12, first_visit: '2025-12-10', last_visit: '2026-04-15', avg_interval_days: 11, days_since_last: 3,   status: 'active'  as VisitStatus },
  { id: 3, name: 'Дина Нурланова',     phone: '+7 702 876 5432', city: 'Алматы', visits_count: 6,  first_visit: '2026-04-03', last_visit: '2026-04-14', avg_interval_days: 2,  days_since_last: 4,   status: 'active'  as VisitStatus },
  { id: 4, name: 'Арман Сейтжанов',    phone: '+7 701 111 2020', city: 'Алматы', visits_count: 1,  first_visit: '2026-04-10', last_visit: '2026-04-10', avg_interval_days: null as number | null, days_since_last: 8, status: 'active' as VisitStatus },
  { id: 5, name: 'Камила Ермекова',    phone: '+7 707 322 1188', city: 'Алматы', visits_count: 2,  first_visit: '2026-04-08', last_visit: '2026-04-12', avg_interval_days: 4,  days_since_last: 6,   status: 'active'  as VisitStatus },
  { id: 6, name: 'Бакыт Алиев',        phone: '+7 717 333 4040', city: 'Алматы', visits_count: 8,  first_visit: '2025-09-20', last_visit: '2026-03-30', avg_interval_days: 24, days_since_last: 19,  status: 'at_risk' as VisitStatus },
  { id: 7, name: 'Жанар Омарова',      phone: '+7 702 110 3344', city: 'Алматы', visits_count: 5,  first_visit: '2025-10-05', last_visit: '2026-03-22', avg_interval_days: 34, days_since_last: 27,  status: 'at_risk' as VisitStatus },
  { id: 8, name: 'Досжан Марат',       phone: '+7 701 999 0011', city: 'Алматы', visits_count: 3,  first_visit: '2025-12-01', last_visit: '2026-02-11', avg_interval_days: 36, days_since_last: 66,  status: 'lost'    as VisitStatus },
  { id: 9, name: 'Гульмира Ахметова',  phone: '+7 700 444 2211', city: 'Алматы', visits_count: 2,  first_visit: '2025-08-14', last_visit: '2025-12-20', avg_interval_days: 128, days_since_last: 119, status: 'lost' as VisitStatus },
  { id: 10, name: 'Ержан Султанов',    phone: '+7 707 654 7788', city: 'Алматы', visits_count: 0,  first_visit: null as string | null, last_visit: null as string | null, avg_interval_days: null as number | null, days_since_last: null as number | null, status: 'never' as VisitStatus },
];

const monthly = [
  { month: '2025-05', visits: 42,  unique: 18 },
  { month: '2025-06', visits: 56,  unique: 22 },
  { month: '2025-07', visits: 61,  unique: 25 },
  { month: '2025-08', visits: 48,  unique: 21 },
  { month: '2025-09', visits: 72,  unique: 28 },
  { month: '2025-10', visits: 85,  unique: 31 },
  { month: '2025-11', visits: 79,  unique: 30 },
  { month: '2025-12', visits: 94,  unique: 34 },
  { month: '2026-01', visits: 68,  unique: 26 },
  { month: '2026-02', visits: 76,  unique: 29 },
  { month: '2026-03', visits: 101, unique: 38 },
  { month: '2026-04', visits: 47,  unique: 22 },
];

// Метрики текущего месяца (для моков)
const visits_this_month = 47;
const visitors_this_month = 22;
const new_this_month = 5; // впервые в этом месяце
const returning_this_month = visitors_this_month - new_this_month;
const return_rate = +((returning_this_month / visitors_this_month) * 100).toFixed(1);

const summary = {
  total_clients: clients.length,
  total_visits: clients.reduce((s, c) => s + c.visits_count, 0),
  avg_visits_per_client: +(clients.reduce((s, c) => s + c.visits_count, 0) / clients.length).toFixed(2),
  active: clients.filter((c) => c.status === 'active').length,
  at_risk: clients.filter((c) => c.status === 'at_risk').length,
  lost: clients.filter((c) => c.status === 'lost').length,
  never: clients.filter((c) => c.status === 'never').length,
  visits_this_month,
  visitors_this_month,
  new_this_month,
  returning_this_month,
  return_rate,
  thresholds: { active_days: 14, at_risk_days: 30 },
};

export default function LoyaltyDemoPage() {
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q);
    });
  }, [statusFilter, search]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.visits));

  return (
    <div className="min-h-screen p-6" style={{ background: '#0b0c0d', color: '#e5e7eb' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase mb-1" style={{ color: '#f59e0b' }}>DEMO · кофейня · моки</div>
            <h1 className="text-2xl font-semibold">Лояльность гостей</h1>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              Посещаемость, частота и возвратность. Активный — визит за последние {summary.thresholds.active_days} дн.,
              в зоне риска — до {summary.thresholds.at_risk_days} дн., потерянный — дольше.
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-medium hover:bg-[#16a34a] transition">
            + Отметить визит
          </button>
        </div>

        <div className="text-xs uppercase tracking-wide" style={{ color: '#9ca3af' }}>Текущий месяц</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Пришли за месяц"   value={summary.visitors_this_month}               hint={`${summary.visits_this_month} визитов`}                                          accent="text-[#4ade80]" />
          <Stat label="Впервые"           value={summary.new_this_month}                    hint="новые гости"                                                                       accent="text-blue-400" />
          <Stat label="Возвратность"      value={`${summary.return_rate}%`}                 hint={`${summary.returning_this_month} повторных из ${summary.visitors_this_month}`}    accent="text-purple-400" />
          <Stat label="Ср. визитов / гостя" value={summary.avg_visits_per_client.toFixed(2)} hint="за всё время" />
        </div>

        <div className="text-xs uppercase tracking-wide pt-1" style={{ color: '#9ca3af' }}>Статусы клиентов</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Всего клиентов" value={summary.total_clients} />
          <Stat label="Активные"       value={summary.active}  accent="text-green-400" />
          <Stat label="В зоне риска"   value={summary.at_risk} accent="text-yellow-500" />
          <Stat label="Потерянные"     value={summary.lost}    accent="text-red-400" />
        </div>

        <div className="rounded-xl p-4 border" style={{ background: '#15171a', borderColor: '#262a30' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Визиты по месяцам</h2>
            <span className="text-xs" style={{ color: '#9ca3af' }}>последние 12 мес</span>
          </div>
          <div className="flex items-end gap-1.5">
            {monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px]" style={{ color: '#9ca3af' }}>{m.visits}</div>
                <div className="w-full h-24 flex items-end">
                  <div
                    className="w-full rounded-t bg-[#22c55e]/70 hover:bg-[#22c55e] transition"
                    style={{ height: `${(m.visits / maxMonthly) * 100}%`, minHeight: 4 }}
                    title={`${m.month}: ${m.visits} визитов, ${m.unique} уник.`}
                  />
                </div>
                <div className="text-[10px]" style={{ color: '#9ca3af' }}>{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, городу"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border"
            style={{ background: '#15171a', color: '#e5e7eb', borderColor: '#262a30' }}
          />
          <div className="flex gap-1">
            {(['all', 'active', 'at_risk', 'lost', 'never'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  statusFilter === s ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'hover:bg-white/5'
                }`}
                style={statusFilter === s ? {} : { color: '#9ca3af', borderColor: '#262a30' }}
              >
                {s === 'all' ? 'Все' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border" style={{ background: '#15171a', borderColor: '#262a30' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: '#9ca3af' }}>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium text-center">Визитов</th>
                <th className="px-4 py-3 font-medium">Первый</th>
                <th className="px-4 py-3 font-medium">Последний</th>
                <th className="px-4 py-3 font-medium text-center">Ср. интервал</th>
                <th className="px-4 py-3 font-medium text-center">Без визита</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t hover:bg-white/[0.02] transition" style={{ borderColor: '#262a30' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{c.city}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{c.phone}</td>
                  <td className="px-4 py-3 text-center font-semibold">{c.visits_count}</td>
                  <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{fmt(c.first_visit)}</td>
                  <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{fmt(c.last_visit)}</td>
                  <td className="px-4 py-3 text-center" style={{ color: '#9ca3af' }}>
                    {c.avg_interval_days ? `${c.avg_interval_days} дн` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.days_since_last === null ? (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    ) : (
                      <span
                        className={
                          c.status === 'lost' ? 'text-red-400 font-medium'
                            : c.status === 'at_risk' ? 'text-yellow-500 font-medium'
                            : ''
                        }
                        style={c.status === 'active' || c.status === 'never' ? { color: '#9ca3af' } : {}}
                      >
                        {c.days_since_last} дн
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, hint }: { label: string; value: number | string; accent?: string; hint?: string }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: '#15171a', borderColor: '#262a30' }}>
      <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>{label}</div>
      <div className={`text-2xl font-semibold ${accent || ''}`}>{value}</div>
      {hint && <div className="text-[11px] mt-1" style={{ color: '#9ca3af' }}>{hint}</div>}
    </div>
  );
}

function fmt(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
