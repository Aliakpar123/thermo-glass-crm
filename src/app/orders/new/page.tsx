'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { Client, ProductType, PRODUCT_TYPE_LABELS } from '@/types';

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client_id');

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: preselectedClientId || '',
    product_type: 'steklopaket' as ProductType,
    description: '',
    dimensions: '',
    quantity: 1,
    amount: 0,
    prepayment: 0,
  });

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then(setClients)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (preselectedClientId) {
      setForm((f) => ({ ...f, client_id: preselectedClientId }));
    }
  }, [preselectedClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: Number(form.client_id),
          quantity: Number(form.quantity),
          amount: Number(form.amount),
          prepayment: Number(form.prepayment),
        }),
      });
      if (res.ok) {
        const order = await res.json();
        router.push(`/orders/${order.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          &larr; Назад
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Новый заказ</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {loading ? (
          <div className="text-gray-500">Загрузка...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
              <select
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите клиента</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип продукта *</label>
              <select
                required
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value as ProductType })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Детали заказа, особые требования..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Размеры</label>
                <input
                  type="text"
                  value={form.dimensions}
                  onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: 1200x800 мм"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма ({'\u20B8'}) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Предоплата ({'\u20B8'})</label>
                <input
                  type="number"
                  min={0}
                  value={form.prepayment || ''}
                  onChange={(e) => setForm({ ...form, prepayment: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
              >
                {saving ? 'Создание...' : 'Создать заказ'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Layout>
      <Suspense fallback={<div className="text-gray-500">Загрузка...</div>}>
        <NewOrderForm />
      </Suspense>
    </Layout>
  );
}
