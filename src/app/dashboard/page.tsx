'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import { Lead, Order, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, PRODUCT_TYPE_LABELS } from '@/types';

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/leads').then((r) => r.json()),
      fetch('/api/orders').then((r) => r.json()),
    ])
      .then(([leadsData, ordersData]) => {
        setLeads(leadsData);
        setOrders(ordersData);
      })
      .finally(() => setLoading(false));
  }, []);

  const newLeads = leads.filter((l) => l.status === 'new');
  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const completedThisMonth = orders.filter(
    (o) => o.status === 'completed' && new Date(o.updated_at) >= monthStart
  );
  const revenueThisMonth = completedThisMonth.reduce((sum, o) => sum + o.amount, 0);

  const stats = [
    { label: 'Новые заявки', value: newLeads.length, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Заказы в работе', value: activeOrders.length, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Завершено за месяц', value: completedThisMonth.length, color: 'text-green-600', bg: 'bg-green-50' },
    {
      label: 'Выручка за месяц',
      value: revenueThisMonth.toLocaleString('ru-RU') + ' \u20B8',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const latestLeads = [...leads].sort((a, b) => b.id - a.id).slice(0, 5);
  const latestOrders = [...orders].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-5 shadow-sm`}>
                  <div className="text-sm text-gray-600 mb-1">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latest leads */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Последние заявки</h2>
                  <Link href="/leads" className="text-blue-600 text-sm hover:underline">
                    Все заявки
                  </Link>
                </div>
                {latestLeads.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет заявок</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 font-medium">Имя</th>
                        <th className="pb-2 font-medium">Источник</th>
                        <th className="pb-2 font-medium">Статус</th>
                        <th className="pb-2 font-medium">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestLeads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2.5">{lead.name}</td>
                          <td className="py-2.5">{LEAD_SOURCE_LABELS[lead.source]}</td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                lead.status === 'new'
                                  ? 'bg-blue-100 text-blue-800'
                                  : lead.status === 'contacted'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : lead.status === 'converted'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {LEAD_STATUS_LABELS[lead.status]}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-500">
                            {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Latest orders */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Последние заказы</h2>
                  <Link href="/orders" className="text-blue-600 text-sm hover:underline">
                    Все заказы
                  </Link>
                </div>
                {latestOrders.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет заказов</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 font-medium">№</th>
                        <th className="pb-2 font-medium">Продукт</th>
                        <th className="pb-2 font-medium">Сумма</th>
                        <th className="pb-2 font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestOrders.map((order) => (
                        <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2.5">
                            <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                              #{order.id}
                            </Link>
                          </td>
                          <td className="py-2.5">{PRODUCT_TYPE_LABELS[order.product_type]}</td>
                          <td className="py-2.5">{order.amount.toLocaleString('ru-RU')} \u20B8</td>
                          <td className="py-2.5">
                            <StatusBadge status={order.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
