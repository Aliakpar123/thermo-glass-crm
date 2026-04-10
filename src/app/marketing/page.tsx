'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import { LEAD_SOURCE_LABELS, PRODUCT_TYPE_LABELS } from '@/types';

const PieChart = dynamic(() => import('recharts').then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((mod) => mod.Cell), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });

// Matches the actual API response from /api/marketing
interface MarketingData {
  sources_distribution: { source: string; count: number }[];
  monthly_revenue: { month: string; revenue: number; orders_count: number }[];
  conversion: {
    total_leads: number;
    converted_leads: number;
    conversion_rate: number;
  };
  popular_products: { product_type: string; count: number; total_revenue: number }[];
  average_check: number;
  total_revenue: number;
  total_orders: number;
  lead_sources: { source: string; count: number }[];
}

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

type Period = 'month' | 'quarter' | 'year' | 'all';

export default function MarketingPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/marketing?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'Этот месяц' },
    { key: 'quarter', label: '3 месяца' },
    { key: 'year', label: 'Год' },
    { key: 'all', label: 'Все время' },
  ];

  const pieData = (data?.lead_sources || []).map((s) => ({
    name: LEAD_SOURCE_LABELS[s.source as keyof typeof LEAD_SOURCE_LABELS] || s.source,
    value: s.count,
  }));

  const barData = [...(data?.monthly_revenue || [])].reverse();

  const topProduct = data?.popular_products?.[0];

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Маркетинг и аналитика</h1>

        {/* Period filter */}
        <div className="flex gap-2 flex-wrap">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">Конверсия (заявки &rarr; клиенты)</div>
                <div className="text-2xl font-bold text-blue-600">
                  {(data.conversion?.conversion_rate ?? 0).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {data.conversion?.converted_leads ?? 0} из {data.conversion?.total_leads ?? 0} заявок
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">Средний чек</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {(data.average_check ?? 0).toLocaleString('ru-RU')} {'\u20B8'}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">Общая выручка</div>
                <div className="text-2xl font-bold text-green-600">
                  {(data.total_revenue ?? 0).toLocaleString('ru-RU')} {'\u20B8'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {data.total_orders ?? 0} заказов
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">Популярный продукт</div>
                <div className="text-lg font-bold text-gray-900">
                  {topProduct
                    ? PRODUCT_TYPE_LABELS[topProduct.product_type as keyof typeof PRODUCT_TYPE_LABELS] || topProduct.product_type
                    : '\u2014'}
                </div>
                {topProduct && (
                  <div className="text-xs text-gray-400 mt-1">{topProduct.count} заказов</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart: lead sources */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Источники заявок</h2>
                {pieData.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет данных</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
                          }
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bar chart: revenue by month */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Выручка по месяцам</h2>
                {barData.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет данных</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Tooltip
                          formatter={(value: any) => [
                            `${Number(value).toLocaleString('ru-RU')} \u20B8`,
                            'Выручка',
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Выручка" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Products table */}
            {data.popular_products && data.popular_products.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Продукты по популярности</h2>
                <table className="w-full text-sm text-gray-900">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Продукт</th>
                      <th className="pb-2 font-medium">Заказов</th>
                      <th className="pb-2 font-medium text-right">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.popular_products.map((p) => (
                      <tr key={p.product_type} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2.5">
                          {PRODUCT_TYPE_LABELS[p.product_type as keyof typeof PRODUCT_TYPE_LABELS] || p.product_type}
                        </td>
                        <td className="py-2.5">{p.count}</td>
                        <td className="py-2.5 text-right">
                          {(p.total_revenue ?? 0).toLocaleString('ru-RU')} {'\u20B8'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-500">Нет данных</div>
        )}
      </div>
    </Layout>
  );
}
