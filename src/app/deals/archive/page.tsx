'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';

interface ArchivedDeal {
  id: number;
  client_name: string | null;
  client_phone: string | null;
  client_city: string | null;
  manager_name: string | null;
  product_type: string | null;
  amount: number | null;
  status: string | null;
  archived_at: string;
  days_archived: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  contacted: 'Связались',
  measurement: 'Замер',
  sent_to_factory: 'На заводе',
  calculation: 'Расчёт',
  approved: 'Согласована',
  paid: 'Оплачена',
  factory: 'Производство',
  delivery: 'Доставка',
  installation: 'Монтаж',
  completed: 'Завершена',
  lost: 'Потеряна',
};

function formatAmount(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n);
}

export default function ArchivePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const isAdmin = userRole === 'admin';
  const [deals, setDeals] = useState<ArchivedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchArchive = useCallback(() => {
    setLoading(true);
    fetch('/api/deals/archive')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin) fetchArchive();
  }, [isAdmin, fetchArchive]);

  const handleRestore = async (deal: ArchivedDeal) => {
    if (!confirm(`Восстановить сделку "${deal.client_name || '—'}"?`)) return;
    setActionId(deal.id);
    try {
      const res = await fetch(`/api/orders/${deal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        alert('Не удалось восстановить.');
      }
    } finally {
      setActionId(null);
    }
  };

  const handleHardDelete = async (deal: ArchivedDeal) => {
    if (!confirm(`Удалить НАВСЕГДА сделку "${deal.client_name || '—'}"?\n\nЭто действие нельзя отменить!`)) return;
    setActionId(deal.id);
    try {
      const res = await fetch(`/api/orders/${deal.id}?hard=1`, { method: 'DELETE' });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        alert('Не удалось удалить.');
      }
    } finally {
      setActionId(null);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="text-center py-16 text-gray-500">
          Доступ только для администратора
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">🗂️</span> Архив сделок
          </h1>
          <Link
            href="/deals"
            className="text-sm text-gray-600 hover:text-[#22c55e] font-medium"
          >
            ← К канбану
          </Link>
        </div>

        <div className="text-sm text-gray-500">
          {deals.length === 0 ? 'Архив пуст' : `Сделок в архиве: ${deals.length}`}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : deals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <div>В архиве нет сделок</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3">В архиве</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deals.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.client_name || '—'}</div>
                      <div className="text-xs text-gray-500">{d.client_phone || ''}{d.client_city ? ` · ${d.client_city}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      ₸{formatAmount(Number(d.amount || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {STATUS_LABELS[d.status || ''] || d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.manager_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {d.days_archived != null ? `${d.days_archived} дн назад` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleRestore(d)}
                          disabled={actionId === d.id}
                          className="px-3 py-1 text-xs font-medium text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 rounded-md transition disabled:opacity-50"
                        >
                          ↺ Восстановить
                        </button>
                        <button
                          onClick={() => handleHardDelete(d)}
                          disabled={actionId === d.id}
                          className="px-3 py-1 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-md transition disabled:opacity-50"
                          title="Удалить навсегда"
                        >
                          🗑 Навсегда
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
