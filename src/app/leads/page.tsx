'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { Lead, LeadSource, LeadStatus, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LOSS_REASON_LABELS } from '@/types';

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    source: 'phone' as LeadSource,
    message: '',
  });
  const [lossModalLeadId, setLossModalLeadId] = useState<number | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossReasonOther, setLossReasonOther] = useState('');

  const fetchLeads = () => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then(setLeads)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filtered =
    statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: '', phone: '', source: 'phone', message: '' });
        fetchLeads();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleContact = async (lead: Lead) => {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'contacted' }),
    });
    if (res.ok) fetchLeads();
  };

  const handleMarkLost = async () => {
    if (!lossModalLeadId || !lossReason) return;
    const reason = lossReason === 'other' ? (lossReasonOther || 'Другое') : lossReason;
    const res = await fetch(`/api/leads/${lossModalLeadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lost', loss_reason: reason }),
    });
    if (res.ok) {
      setLossModalLeadId(null);
      setLossReason('');
      setLossReasonOther('');
      fetchLeads();
    }
  };

  const handleCalculation = (lead: Lead & { client_id?: number }) => {
    const params = new URLSearchParams({
      lead_id: String(lead.id),
      client_id: String(lead.client_id || ''),
      client_name: lead.name,
      client_phone: lead.phone,
    });
    router.push(`/orders/calculation?${params.toString()}`);
  };

  const statusTabs: { key: LeadStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'contacted', label: 'Связались' },
    { key: 'converted', label: 'Конвертированы' },
    { key: 'lost', label: 'Потеряны' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Добавить заявку
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-75">
                  ({leads.filter((l) => l.status === tab.key).length})
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
                    <th className="pb-3 font-medium">Имя</th>
                    <th className="pb-3 font-medium">Телефон</th>
                    <th className="pb-3 font-medium">Источник</th>
                    <th className="pb-3 font-medium">Сообщение</th>
                    <th className="pb-3 font-medium">Статус</th>
                    <th className="pb-3 font-medium">Дата</th>
                    <th className="pb-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium">{lead.name}</td>
                      <td className="py-3">{lead.phone}</td>
                      <td className="py-3">{LEAD_SOURCE_LABELS[lead.source]}</td>
                      <td className="py-3 max-w-[200px] truncate">{lead.message || '\u2014'}</td>
                      <td className="py-3">
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
                      <td className="py-3 text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {lead.status === 'new' && (
                            <button
                              onClick={() => handleContact(lead)}
                              className="px-2.5 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition"
                            >
                              Связаться
                            </button>
                          )}
                          {(lead.status === 'new' || lead.status === 'contacted') && (
                            <>
                              <button
                                onClick={() => handleCalculation(lead as Lead & { client_id?: number })}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                              >
                                Оформить заявку
                              </button>
                              <button
                                onClick={() => { setLossModalLeadId(lead.id); setLossReason(''); setLossReasonOther(''); }}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                              >
                                Потерян
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Нет заявок
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Loss Reason Modal */}
      {lossModalLeadId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Причина потери</h2>
                <button onClick={() => setLossModalLeadId(null)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(LOSS_REASON_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="loss_reason"
                      value={key}
                      checked={lossReason === key}
                      onChange={() => setLossReason(key)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-900">{label}</span>
                  </label>
                ))}
                {lossReason === 'other' && (
                  <input
                    type="text"
                    value={lossReasonOther}
                    onChange={(e) => setLossReasonOther(e.target.value)}
                    placeholder="Укажите причину..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setLossModalLeadId(null)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={!lossReason}
                  onClick={handleMarkLost}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  Отметить как потерян
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Новая заявка</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Телефон *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сообщение</label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
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
