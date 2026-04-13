'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import {
  EXPENSE_CATEGORIES,
  GENERAL_EXPENSE_CATEGORIES,
  PAYMENT_TYPE_LABELS,
} from '@/types';

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });

interface FinanceData {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  chartData: { month: string; revenue: number; expenses: number }[];
  debts: { id: number; amount: number; client_name: string; client_phone: string; paid: number; debt: number; status: string }[];
  recentPayments: { id: number; order_id: number; amount: number; payment_type: string; payment_date: string; client_name: string; notes: string }[];
  recentExpenses: { id: number; category: string; description: string; amount: number; created_at: string; type: string; order_id: number }[];
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр', '05': 'Май', '06': 'Июн',
  '07': 'Июл', '08': 'Авг', '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек',
};

export default function FinancePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const userId = (session?.user as { id?: string })?.id || '';

  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  // Add general expense modal
  const [showExpModal, setShowExpModal] = useState(false);
  const [expCategory, setExpCategory] = useState('rent');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const handleAddExpense = async () => {
    if (!expDescription || !expAmount) return;
    setSaving(true);
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expCategory,
          description: expDescription,
          amount: Number(expAmount),
          expense_date: expDate,
          created_by: userId ? Number(userId) : null,
        }),
      });
      setShowExpModal(false);
      setExpDescription('');
      setExpAmount('');
      // Refresh
      const res = await fetch(`/api/finance?period=${period}`);
      const d = await res.json();
      setData(d);
    } catch {
      // ignore
    }
    setSaving(false);
  };

  if (!['admin', 'accountant'].includes(userRole)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-900 text-lg">Доступ запрещен</p>
        </div>
      </Layout>
    );
  }

  const chartData = (data?.chartData || []).map((d) => ({
    ...d,
    name: MONTH_NAMES[d.month.split('-')[1]] || d.month,
  }));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Финансы</h1>
            <p className="text-sm text-gray-500 mt-1">Обзор финансовых показателей</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">Все время</option>
              <option value="month">Месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
            </select>
            <Link
              href="/finance/expenses"
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
            >
              Общие расходы
            </Link>
            <button
              onClick={() => setShowExpModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              + Добавить расход
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Выручка</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(data.totalRevenue)} &#8376;</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Расходы</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(data.totalExpenses)} &#8376;</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Прибыль</p>
                <p className={`text-2xl font-bold mt-1 ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.profit >= 0 ? '+' : ''}{formatMoney(data.profit)} &#8376;
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Задолженности</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatMoney(data.debts.reduce((s, d) => s + Number(d.debt), 0))} &#8376;
                </p>
                <p className="text-xs text-gray-500 mt-1">{data.debts.length} сделок</p>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Выручка и расходы по месяцам</h2>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fill: '#374151', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#374151', fontSize: 12 }} />
                      <Tooltip formatter={(value: unknown) => formatMoney(Number(value)) + ' ₸'} />
                      <Legend />
                      <Bar dataKey="revenue" name="Выручка" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Расходы" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Outstanding debts table */}
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Задолженности клиентов</h2>
              {data.debts.length === 0 ? (
                <p className="text-sm text-gray-500">Нет задолженностей</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-900 font-semibold">Сделка</th>
                        <th className="text-left py-2 px-3 text-gray-900 font-semibold">Клиент</th>
                        <th className="text-right py-2 px-3 text-gray-900 font-semibold">Сумма</th>
                        <th className="text-right py-2 px-3 text-gray-900 font-semibold">Оплачено</th>
                        <th className="text-right py-2 px-3 text-gray-900 font-semibold">Долг</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.debts.map((d) => (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <Link href={`/deals/${d.id}`} className="text-blue-600 hover:underline font-medium">
                              #{d.id}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-gray-900">{d.client_name || '-'}</td>
                          <td className="py-2 px-3 text-right text-gray-900">{formatMoney(Number(d.amount))} &#8376;</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatMoney(Number(d.paid))} &#8376;</td>
                          <td className="py-2 px-3 text-right text-red-600 font-medium">{formatMoney(Number(d.debt))} &#8376;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent payments & expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Последние оплаты</h2>
                {data.recentPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет оплат</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <Link href={`/deals/${p.order_id}`} className="text-sm text-blue-600 hover:underline font-medium">
                            #{p.order_id}
                          </Link>
                          <span className="text-sm text-gray-900 ml-2">{p.client_name || '-'}</span>
                          <span className="text-xs text-gray-500 ml-2">{PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-green-600">+{formatMoney(Number(p.amount))} &#8376;</span>
                          <div className="text-xs text-gray-500">{formatDate(p.payment_date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Последние расходы</h2>
                {data.recentExpenses.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет расходов</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentExpenses.map((e) => {
                      const catLabel = e.type === 'deal'
                        ? (EXPENSE_CATEGORIES[e.category] || e.category)
                        : (GENERAL_EXPENSE_CATEGORIES[e.category] || e.category);
                      return (
                        <div key={`${e.type}-${e.id}`} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <span className="text-sm text-gray-900 font-medium">{catLabel}</span>
                            {e.type === 'deal' && e.order_id > 0 && (
                              <Link href={`/deals/${e.order_id}`} className="text-xs text-blue-600 hover:underline ml-2">
                                Сделка #{e.order_id}
                              </Link>
                            )}
                            {e.description && <span className="text-xs text-gray-500 ml-2">{e.description}</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-red-600">-{formatMoney(Number(e.amount))} &#8376;</span>
                            <div className="text-xs text-gray-500">{formatDate(String(e.created_at))}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-500">Ошибка загрузки данных</p>
        )}
      </div>

      {/* Add general expense modal */}
      {showExpModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Добавить общий расход</h3>
              <button onClick={() => setShowExpModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Категория</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  {Object.entries(GENERAL_EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Описание</label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  placeholder="Описание расхода..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Сумма (&#8376;)</label>
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Дата</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <button
                onClick={handleAddExpense}
                disabled={saving || !expDescription || !expAmount}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
