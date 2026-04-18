'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

type VisitStatus = 'active' | 'at_risk' | 'lost' | 'never';

interface LoyaltyClient {
  id: number;
  name: string;
  phone: string;
  city: string;
  manager_name: string | null;
  visits_count: number;
  first_visit: string | null;
  last_visit: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
  status: VisitStatus;
}

interface Summary {
  total_clients: number;
  total_visits: number;
  with_visits: number;
  active: number;
  at_risk: number;
  lost: number;
  never: number;
  avg_visits_per_client: number;
  visits_this_month: number;
  visitors_this_month: number;
  new_this_month: number;
  returning_this_month: number;
  return_rate: number;
  thresholds: { active_days: number; at_risk_days: number };
}

interface Monthly {
  month: string;
  visits: number;
  unique_clients: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  office: 'Офис',
  showroom: 'Шоурум',
  site: 'Объект',
  call: 'Звонок',
  whatsapp: 'WhatsApp',
  other: 'Другое',
};

const STATUS_LABELS: Record<VisitStatus, string> = {
  active: 'Активные',
  at_risk: 'В зоне риска',
  lost: 'Потерянные',
  never: 'Без визитов',
};

const STATUS_COLORS: Record<VisitStatus, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  at_risk: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  lost: 'bg-red-500/15 text-red-400 border-red-500/30',
  never: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function LoyaltyPage() {
  const [clients, setClients] = useState<LoyaltyClient[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '' as string | number,
    visited_at: new Date().toISOString().slice(0, 16),
    channel: 'office',
    notes: '',
  });

  const load = () => {
    setLoading(true);
    fetch('/api/loyalty')
      .then((r) => r.json())
      .then((data) => {
        setClients(data.clients || []);
        setSummary(data.summary || null);
        setMonthly(data.monthly || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.city?.toLowerCase().includes(q)
      );
    });
  }, [clients, statusFilter, search]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.visits));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/loyalty/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({
          client_id: '',
          visited_at: new Date().toISOString().slice(0, 16),
          channel: 'office',
          notes: '',
        });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Лояльность гостей
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Посещаемость, частота и возвратность. Активный — визит за последние{' '}
              {summary?.thresholds.active_days || 14} дн., в зоне риска — до{' '}
              {summary?.thresholds.at_risk_days || 30} дн., потерянный — дольше.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-medium hover:bg-[#16a34a] transition"
          >
            + Отметить визит
          </button>
        </div>

        {/* KPI: за текущий месяц */}
        {summary && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Текущий месяц
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Пришли за месяц"
                value={summary.visitors_this_month}
                hint={`${summary.visits_this_month} визитов`}
                accent="text-[#4ade80]"
              />
              <StatCard
                label="Впервые"
                value={summary.new_this_month}
                hint="новые гости"
                accent="text-blue-400"
              />
              <StatCard
                label="Возвратность"
                value={`${summary.return_rate}%`}
                hint={`${summary.returning_this_month} повторных из ${summary.visitors_this_month}`}
                accent="text-purple-400"
              />
              <StatCard
                label="Ср. визитов / гостя"
                value={summary.avg_visits_per_client.toFixed(2)}
                hint="за всё время"
              />
            </div>
            <div className="text-xs uppercase tracking-wide pt-2" style={{ color: 'var(--text-muted)' }}>
              Статусы клиентов
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Всего клиентов" value={summary.total_clients} />
              <StatCard
                label="Активные"
                value={summary.active}
                accent="text-green-400"
                onClick={() => setStatusFilter('active')}
              />
              <StatCard
                label="В зоне риска"
                value={summary.at_risk}
                accent="text-yellow-500"
                onClick={() => setStatusFilter('at_risk')}
              />
              <StatCard
                label="Потерянные"
                value={summary.lost}
                accent="text-red-400"
                onClick={() => setStatusFilter('lost')}
              />
            </div>
          </div>
        )}

        {/* Monthly chart */}
        {monthly.length > 0 && (
          <div
            className="rounded-xl p-4 border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Визиты по месяцам
              </h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                последние 12 мес
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              {monthly.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {m.visits}
                  </div>
                  <div className="w-full h-24 flex items-end">
                    <div
                      className="w-full rounded-t bg-[#22c55e]/70 hover:bg-[#22c55e] transition"
                      style={{ height: `${(m.visits / maxMonthly) * 100}%`, minHeight: 4 }}
                      title={`${m.month}: ${m.visits} визитов, ${m.unique_clients} уник. клиентов`}
                    />
                  </div>
                  <div
                    className="text-[10px] whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {m.month.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, городу"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border)',
            }}
          />
          <div className="flex gap-1">
            {(['all', 'active', 'at_risk', 'lost', 'never'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  statusFilter === s
                    ? 'bg-[#22c55e] text-white border-[#22c55e]'
                    : 'hover:bg-white/5'
                }`}
                style={
                  statusFilter === s
                    ? {}
                    : { color: 'var(--text-muted)', borderColor: 'var(--border)' }
                }
              >
                {s === 'all' ? 'Все' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Clients table */}
        <div
          className="rounded-xl overflow-hidden border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Нет клиентов под фильтр
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-4 py-3 font-medium">Клиент</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium text-center">Визитов</th>
                  <th className="px-4 py-3 font-medium">Первый</th>
                  <th className="px-4 py-3 font-medium">Последний</th>
                  <th className="px-4 py-3 font-medium text-center">Ср. интервал</th>
                  <th className="px-4 py-3 font-medium text-center">Без визита</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-white/[0.02] transition"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="font-medium hover:text-[#4ade80] transition"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {c.name}
                      </Link>
                      {c.city && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {c.city}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {c.phone}
                    </td>
                    <td
                      className="px-4 py-3 text-center font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {c.visits_count}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(c.first_visit)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(c.last_visit)}
                    </td>
                    <td
                      className="px-4 py-3 text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {c.avg_interval_days ? `${c.avg_interval_days} дн` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.days_since_last === null ? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <span
                          className={
                            c.status === 'lost'
                              ? 'text-red-400 font-medium'
                              : c.status === 'at_risk'
                              ? 'text-yellow-500 font-medium'
                              : ''
                          }
                          style={
                            c.status === 'active' || c.status === 'never'
                              ? { color: 'var(--text-muted)' }
                              : {}
                          }
                        >
                          {c.days_since_last} дн
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border ${
                          STATUS_COLORS[c.status]
                        }`}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl p-5 space-y-3 border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Новый визит
              </h2>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Клиент
                </label>
                <select
                  required
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <option value="">Выберите...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Дата и время
                  </label>
                  <input
                    type="datetime-local"
                    value={form.visited_at}
                    onChange={(e) => setForm({ ...form, visited_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Канал
                  </label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Комментарий
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border)',
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.client_id}
                  className="px-4 py-2 rounded-lg text-sm bg-[#22c55e] text-white font-medium disabled:opacity-50"
                >
                  {saving ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  accent,
  hint,
  onClick,
}: {
  label: string;
  value: number | string;
  accent?: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="text-left rounded-xl p-4 border transition hover:border-[#22c55e]/40 disabled:cursor-default"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className={`text-2xl font-semibold ${accent || ''}`} style={accent ? {} : { color: 'var(--text-primary)' }}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </div>
      )}
    </button>
  );
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}
