'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import { Order, OrderStatus, ORDER_STATUS_LABELS, PRODUCT_TYPE_LABELS } from '@/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  const statusTabs: { key: OrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Все' },
    ...Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => ({
      key: key as OrderStatus,
      label,
    })),
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
          <div className="flex gap-2">
            <a
              href="/api/export/orders"
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              Скачать Excel
            </a>
            <Link
              href="/orders/new"
              className="bg-[#22c55e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#16a34a] transition"
            >
              Новый заказ
            </Link>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 w-fit">
          <span className="px-4 py-1.5 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm">
            Таблица
          </span>
          <Link
            href="/orders/kanban"
            className="px-4 py-1.5 rounded-md text-sm font-medium text-gray-900 hover:bg-white transition"
          >
            Канбан
          </Link>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                statusFilter === tab.key
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className="ml-1 opacity-75">
                  ({orders.filter((o) => o.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          {loading ? (
            <div className="text-gray-500">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">№</th>
                    <th className="pb-3 font-medium">Клиент</th>
                    <th className="pb-3 font-medium">Продукт</th>
                    <th className="pb-3 font-medium">Сумма</th>
                    <th className="pb-3 font-medium">Статус</th>
                    <th className="pb-3 font-medium">Менеджер</th>
                    <th className="pb-3 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">
                          #{order.id}
                        </Link>
                      </td>
                      <td className="py-3">
                        {order.client_name ? (
                          <Link href={`/clients/${order.client_id}`} className="text-blue-600 hover:underline">
                            {order.client_name}
                          </Link>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                      <td className="py-3">{PRODUCT_TYPE_LABELS[order.product_type]}</td>
                      <td className="py-3 font-medium">{order.amount.toLocaleString('ru-RU')} \u20B8</td>
                      <td className="py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3">{order.manager_name || '\u2014'}</td>
                      <td className="py-3 text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Нет заказов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
