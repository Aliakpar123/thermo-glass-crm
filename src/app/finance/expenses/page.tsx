'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GENERAL_EXPENSE_CATEGORIES } from '@/types';

interface GeneralExpense {
  id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function GeneralExpensesPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const userId = (session?.user as { id?: string })?.id || '';

  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('rent');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = () => {
    setLoading(true);
    const params = filterCategory ? `?category=${filterCategory}` : '';
    fetch(`/api/expenses${params}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setExpenses(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, [filterCategory]);

  const handleAdd = async () => {
    if (!description || !amount) return;
    setSaving(true);
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          amount: Number(amount),
          expense_date: expDate,
          created_by: userId ? Number(userId) : null,
        }),
      });
      setShowModal(false);
      setDescription('');
      setAmount('');
      fetchExpenses();
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

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/finance" className="text-sm text-blue-600 hover:underline">Финансы</Link>
              <span className="text-sm text-gray-400">/</span>
              <span className="text-sm text-gray-900">Общие расходы</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Общие расходы</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition"
          >
            + Расход
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Все категории</option>
            {Object.entries(GENERAL_EXPENSE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Загрузка...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Нет расходов</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-900 font-semibold">Дата</th>
                    <th className="text-left py-3 px-4 text-gray-900 font-semibold">Категория</th>
                    <th className="text-left py-3 px-4 text-gray-900 font-semibold">Описание</th>
                    <th className="text-right py-3 px-4 text-gray-900 font-semibold">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{formatDate(e.expense_date)}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-900 rounded-full">
                          {GENERAL_EXPENSE_CATEGORIES[e.category] || e.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{e.description}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium">{formatMoney(Number(e.amount))} &#8376;</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={3} className="py-3 px-4 text-gray-900 font-semibold">Итого</td>
                    <td className="py-3 px-4 text-right text-red-600 font-bold text-base">{formatMoney(total)} &#8376;</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Новый расход</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  placeholder="Описание расхода..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Сумма (&#8376;)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
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
                onClick={handleAdd}
                disabled={saving || !description || !amount}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50"
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
