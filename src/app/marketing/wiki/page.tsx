'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { PAIN_CATEGORIES, LOSS_REASON_LABELS } from '@/types';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });

interface PainStat {
  category: string;
  count: number;
}

interface PainByCity {
  city: string;
  category: string;
  count: number;
}

interface Segment {
  city: string;
  client_count: number;
  avg_check: number;
  completed: number;
}

interface Objection {
  reason: string;
  count: number;
}

interface WikiData {
  pain_stats: PainStat[];
  pains_by_city: PainByCity[];
  pains_by_room: { room_type: string; category: string; count: number }[];
  segments: Segment[];
  objections: Objection[];
}

// Expand comma-separated pain categories into individual entries
function expandPainStats(stats: PainStat[]): PainStat[] {
  const map: Record<string, number> = {};
  for (const s of stats) {
    const cats = s.category.split(',').filter(Boolean);
    for (const c of cats) {
      map[c] = (map[c] || 0) + Number(s.count);
    }
  }
  return Object.entries(map)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function expandPainsByCity(items: PainByCity[]): PainByCity[] {
  const map: Record<string, Record<string, number>> = {};
  for (const item of items) {
    const cats = item.category.split(',').filter(Boolean);
    for (const c of cats) {
      if (!map[item.city]) map[item.city] = {};
      map[item.city][c] = (map[item.city][c] || 0) + Number(item.count);
    }
  }
  const result: PainByCity[] = [];
  for (const [city, cats] of Object.entries(map)) {
    for (const [category, count] of Object.entries(cats)) {
      result.push({ city, category, count });
    }
  }
  return result.sort((a, b) => b.count - a.count);
}

export default function MarketingWikiPage() {
  const [data, setData] = useState<WikiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/wiki')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Загрузка...</div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-900 text-sm">Ошибка загрузки данных</div>
        </div>
      </Layout>
    );
  }

  const expandedPainStats = expandPainStats(data.pain_stats);
  const expandedPainsByCity = expandPainsByCity(data.pains_by_city);

  // Prepare chart data for pain stats
  const painChartData = expandedPainStats.map((s) => ({
    name: PAIN_CATEGORIES[s.category] || s.category,
    count: Number(s.count),
  }));

  // Pains by city: top 3 per city
  const cityPainMap: Record<string, { category: string; count: number }[]> = {};
  for (const item of expandedPainsByCity) {
    if (!cityPainMap[item.city]) cityPainMap[item.city] = [];
    if (cityPainMap[item.city].length < 3) {
      cityPainMap[item.city].push({ category: item.category, count: Number(item.count) });
    }
  }

  // Objections chart data
  const objectionChartData = data.objections.map((o) => ({
    name: LOSS_REASON_LABELS[o.reason] || o.reason,
    count: Number(o.count),
  }));

  // Content ideas from top 5 pains
  const top5Pains = expandedPainStats.slice(0, 5);
  const topCities = Object.keys(cityPainMap).slice(0, 3);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Маркетинг Wiki</h1>
            <p className="text-sm text-gray-900 mt-1">Аналитика болей клиентов</p>
          </div>
          <Link
            href="/marketing/wiki/graph"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="6" cy="6" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="12" cy="18" r="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="7" y1="8" x2="11" y2="16" />
              <line x1="17" y1="8" x2="13" y2="16" />
            </svg>
            Граф знаний
          </Link>
        </div>

        {/* Section 1: Pain Stats */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Боли клиентов</h2>
          {painChartData.length > 0 ? (
            <div style={{ width: '100%', height: Math.max(300, painChartData.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={painChartData} layout="vertical" margin={{ left: 200, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fill: '#111827', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#111827', fontSize: 12 }} width={190} />
                  <Tooltip contentStyle={{ color: '#111827' }} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-900 text-sm">Нет данных о болях клиентов. Начните добавлять боли в сделках.</p>
          )}
        </div>

        {/* Section 2: Pains by City */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Боли по городам</h2>
          {Object.keys(cityPainMap).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 text-gray-900 font-semibold">Город</th>
                    <th className="text-left px-4 py-2 text-gray-900 font-semibold">Топ боли</th>
                    <th className="text-left px-4 py-2 text-gray-900 font-semibold">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cityPainMap).map(([city, pains]) =>
                    pains.map((p, idx) => (
                      <tr key={`${city}-${idx}`} className="border-t border-gray-100">
                        {idx === 0 && (
                          <td className="px-4 py-2 text-gray-900 font-medium" rowSpan={pains.length}>
                            {city}
                          </td>
                        )}
                        <td className="px-4 py-2 text-gray-900">{PAIN_CATEGORIES[p.category] || p.category}</td>
                        <td className="px-4 py-2 text-gray-900">{p.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-900 text-sm">Нет данных</p>
          )}
        </div>

        {/* Section 3: Client Segments */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Сегменты клиентов</h2>
          {data.segments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.segments.map((seg) => (
                <div key={seg.city} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{seg.city}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-900">Клиентов:</span>
                      <span className="font-medium text-gray-900">{seg.client_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900">Средний чек:</span>
                      <span className="font-medium text-gray-900">
                        {Number(seg.avg_check).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} &#8376;
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900">Завершённые:</span>
                      <span className="font-medium text-green-700">{seg.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-900 text-sm">Нет данных</p>
          )}
        </div>

        {/* Section 4: Objections */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Возражения</h2>
          {objectionChartData.length > 0 ? (
            <div style={{ width: '100%', height: Math.max(250, objectionChartData.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={objectionChartData} layout="vertical" margin={{ left: 160, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fill: '#111827', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#111827', fontSize: 12 }} width={150} />
                  <Tooltip contentStyle={{ color: '#111827' }} />
                  <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-900 text-sm">Нет данных о возражениях</p>
          )}
        </div>

        {/* Section 5: Content Ideas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Идеи для контента</h2>
          {top5Pains.length > 0 ? (
            <div className="space-y-4">
              {top5Pains.map((pain) => {
                const painLabel = PAIN_CATEGORIES[pain.category] || pain.category;
                const city = topCities[0] || 'Астана';
                return (
                  <div key={pain.category} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full mr-2">
                        {painLabel}
                      </span>
                      ({pain.count} упоминаний)
                    </h3>
                    <ul className="space-y-1.5 text-sm text-gray-900">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">&#9679;</span>
                        <span>Instagram пост: {painLabel} &mdash; как решить с обогреваемыми стеклопакетами</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">&#9679;</span>
                        <span>Кейс клиента: {city} &mdash; решили проблему &laquo;{painLabel}&raquo;</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">&#9679;</span>
                        <span>FAQ: Почему {painLabel.toLowerCase()} &mdash; и как с этим бороться</span>
                      </li>
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-900 text-sm">
              Добавьте боли клиентов в сделках, чтобы получить идеи для контента.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
