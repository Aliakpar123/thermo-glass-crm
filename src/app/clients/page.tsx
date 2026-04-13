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

  const [clients, setClients] = useState<(Client & { status?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'transferred'>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const formatPhone = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (!digits.startsWith('7')) digits = '7' + digits;
    if (digits.length > 11) digits = digits.slice(0, 11);
    let formatted = '+7';
    if (digits.length > 1) formatted += ' ' + digits.slice(1, 4);
    if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += ' ' + digits.slice(7, 9);
    if (digits.length > 9) formatted += ' ' + digits.slice(9, 11);
    return formatted;
  };

  const [form, setForm] = useState({
    name: '',
    phone: '+7 ',
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

  const uniqueCities = Array.from(new Set(clients.map((c) => c.city).filter(Boolean))).sort();

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(q) || c.phone.includes(q);
    const matchesCity = !cityFilter || c.city === cityFilter;
    const matchesStatus = statusFilter === 'all' || (c.status || 'active') === statusFilter;
    return matchesSearch && matchesCity && matchesStatus;
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

  // Камилла нажимает "→ В сделки" — создаёт сделку и переходит на канбан
  const handleCreateDeal = async (client: Client) => {
    setSendingId(client.id);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existing_client_id: client.id,
          manager_id: userId ? Number(userId) : 1,
          comment: client.notes || '',
        }),
      });
      if (res.ok) {
        // Redirect to deals kanban
        window.location.href = '/deals';
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
          <div className="flex gap-2">
            <a
              href="/api/export/clients"
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              Скачать Excel
            </a>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#22c55e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#16a34a] transition"
            >
              + Новый клиент
            </button>
          </div>
        </div>

        {isClientManager && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            Нажмите <strong>&laquo;→ В сделки&raquo;</strong> чтобы клиент появился на канбан-доске в "Новый контакт".
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-80 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
            />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
            >
              <option value="">Все города</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'transferred')}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="transferred">Переданные</option>
            </select>
          </div>

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
                        {client.status === 'transferred' && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Передан
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          {client.phone}
                          {client.phone && client.phone !== 'не указан' && (
                            <a
                              href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-500 hover:text-green-600 shrink-0"
                              title="WhatsApp"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </a>
                          )}
                        </span>
                      </td>
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
                              onClick={() => handleCreateDeal(client)}
                              disabled={sendingId === client.id}
                              className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium disabled:opacity-50 whitespace-nowrap"
                            >
                              {sendingId === client.id ? 'Создание...' : '→ В сделки'}
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                    placeholder="ФИО клиента"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                    placeholder="+7 777 123 45 67"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заметки / комментарий</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
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
                    className="px-4 py-2 text-sm text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50 font-medium"
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
