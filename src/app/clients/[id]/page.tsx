'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import { Client, Order, LeadSource, LEAD_SOURCE_LABELS, PRODUCT_TYPE_LABELS } from '@/types';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    source: 'phone' as LeadSource,
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/orders?client_id=${id}`).then((r) => r.json()),
    ])
      .then(([clientData, ordersData]) => {
        setClient(clientData);
        setOrders(ordersData);
        setForm({
          name: clientData.name || '',
          phone: clientData.phone || '',
          email: clientData.email || '',
          city: clientData.city || '',
          address: clientData.address || '',
          source: clientData.source || 'phone',
          notes: clientData.notes || '',
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setClient(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-gray-500">Загрузка...</div>
      </Layout>
    );
  }

  if (!client) {
    return (
      <Layout>
        <div className="text-gray-500">Клиент не найден</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
            &larr; Назад
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        </div>

        {/* Client Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Информация о клиенте</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 text-sm hover:underline"
              >
                Редактировать
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(LEAD_SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Телефон:</span>
                <span className="ml-2 font-medium">{client.phone}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium">{client.email || '\u2014'}</span>
              </div>
              <div>
                <span className="text-gray-500">Город:</span>
                <span className="ml-2 font-medium">{client.city || '\u2014'}</span>
              </div>
              <div>
                <span className="text-gray-500">Источник:</span>
                <span className="ml-2 font-medium">{LEAD_SOURCE_LABELS[client.source]}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500">Адрес:</span>
                <span className="ml-2 font-medium">{client.address || '\u2014'}</span>
              </div>
              {client.notes && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Заметки:</span>
                  <span className="ml-2">{client.notes}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Дата создания:</span>
                <span className="ml-2">{new Date(client.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Client Orders */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Заказы клиента</h2>
            <Link
              href={`/orders/new?client_id=${id}`}
              className="text-blue-600 text-sm hover:underline"
            >
              Создать заказ
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет заказов</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">№</th>
                    <th className="pb-3 font-medium">Продукт</th>
                    <th className="pb-3 font-medium">Сумма</th>
                    <th className="pb-3 font-medium">Статус</th>
                    <th className="pb-3 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                          #{order.id}
                        </Link>
                      </td>
                      <td className="py-3">{PRODUCT_TYPE_LABELS[order.product_type]}</td>
                      <td className="py-3">{order.amount.toLocaleString('ru-RU')} \u20B8</td>
                      <td className="py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
