'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import { Client, LeadSource, LEAD_SOURCE_LABELS } from '@/types';

export default function ClientsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const isClientManager = userRole === 'client_manager';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    source: 'whatsapp' as LeadSource,
    notes: '',
  });

  const userId = (session?.user as { id?: string })?.id || '';

  const fetchClients = () => {
    // client_manager видит только своих клиентов, admin видит всех
    const url = isClientManager && userId ? `/api/clients?manager_id=${userId}` : '/api/clients';
    fetch(url)
      .then((r) => r.json())
      .then(setClients)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, assigned_manager_id: userId ? Number(userId) : null }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: '', phone: '', email: '', city: '', address: '', source: 'whatsapp', notes: '' });
        fetchClients();
      }
    } finally {
      setSaving(false);
    }
  };

  // Камилла нажимает "Передать в Отдел Заявки" — создаёт lead из клиента
  const handleSendToOrders = async (client: Client) => {
    setSendingId(client.id);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: client.name,
          phone: client.phone,
          source: client.source,
          message: `Клиент от ${client.source}. ${client.notes || ''}`.trim(),
          client_id: client.id,
        }),
      });
      if (res.ok) {
        setSuccessId(client.id);
        setTimeout(() => setSuccessId(null), 3000);
      }
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Клиенты</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Новый клиент
          </button>
        </div>

        {isClientManager && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            Заполните данные клиента и нажмите <strong>&laquo;Передать в Отдел Заявки&raquo;</strong>, чтобы Айжан получила заявку.
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-5">
          <input
            type="text"
            placeholder="Поиск по имени или телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 border border-gray-300 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />

          {loading ? (
            <div className="text-gray-500">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">Имя</th>
                    <th className="pb-3 font-medium">Телефон</th>
                    <th className="pb-3 font-medium">Город</th>
                    <th className="pb-3 font-medium">Источник</th>
                    <th className="pb-3 font-medium">Дата</th>
                    {isClientManager && <th className="pb-3 font-medium text-center">Действие</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr key={client.id} className="border-b last:border-0 hover:bg-gray-50 text-gray-900">
                      <td className="py-3">
                        <Link href={`/clients/${client.id}`} className="text-blue-600 hover:underline font-medium">
                          {client.name}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-900">{client.phone}</td>
                      <td className="py-3 text-gray-900">{client.city || '\u2014'}</td>
                      <td className="py-3 text-gray-900">{LEAD_SOURCE_LABELS[client.source]}</td>
                      <td className="py-3 text-gray-500">
                        {new Date(client.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      {isClientManager && (
                        <td className="py-3 text-center">
                          {successId === client.id ? (
                            <span className="text-green-600 text-xs font-medium">Передано!</span>
                          ) : (
                            <button
                              onClick={() => handleSendToOrders(client)}
                              disabled={sendingId === client.id}
                              className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium disabled:opacity-50 whitespace-nowrap"
                            >
                              {sendingId === client.id ? 'Отправка...' : 'Передать в Отдел Заявки'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isClientManager ? 6 : 5} className="py-8 text-center text-gray-500">
                        {search ? 'Ничего не найдено' : 'Нет клиентов'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Client */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Новый клиент</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя клиента *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="ФИО клиента"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {Object.entries(LEAD_SOURCE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заметки / комментарий</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Что хочет клиент, откуда написал..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить клиента'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
