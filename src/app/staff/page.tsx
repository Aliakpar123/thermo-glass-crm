'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import { ROLE_LABELS, UserRole } from '@/types';

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });

interface StaffStats {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  leads_count: number;
  orders_count: number;
  orders_sent_to_factory: number;
  orders_completed: number;
  total_revenue: number;
  avg_check: number;
}

type Period = 'month' | '3months' | 'year' | 'all';

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');
  const [editUser, setEditUser] = useState<StaffStats | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' as UserRole, password: '' });
  const [saving, setSaving] = useState(false);

  const fetchStaff = () => {
    setLoading(true);
    fetch(`/api/staff?period=${period}`)
      .then((r) => r.json())
      .then(setStaff)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStaff();
  }, [period]);

  const openEdit = (s: StaffStats) => {
    setEditUser(s);
    setEditForm({ name: s.name, email: s.email, role: s.role, password: '' });
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editUser.id,
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          password: editForm.password || undefined,
        }),
      });
      if (res.ok) {
        setEditUser(null);
        fetchStaff();
      }
    } finally {
      setSaving(false);
    }
  };

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'Этот месяц' },
    { key: '3months', label: '3 месяца' },
    { key: 'year', label: 'Год' },
    { key: 'all', label: 'Все время' },
  ];

  const bestPerformerId =
    staff.length > 0
      ? staff.reduce((best, s) => (s.total_revenue > best.total_revenue ? s : best), staff[0]).id
      : null;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>

        {/* Period filter */}
        <div className="flex gap-2 flex-wrap">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                period === p.key
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          {loading ? (
            <div className="text-gray-500">Загрузка...</div>
          ) : staff.length === 0 ? (
            <p className="text-gray-500">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">Сотрудник</th>
                    <th className="pb-3 font-medium">Роль</th>
                    <th className="pb-3 font-medium text-center">Заявки</th>
                    <th className="pb-3 font-medium text-center">Заказы</th>
                    <th className="pb-3 font-medium text-center">На завод</th>
                    <th className="pb-3 font-medium text-center">Завершено</th>
                    <th className="pb-3 font-medium text-right">Выручка</th>
                    <th className="pb-3 font-medium text-right">Ср. чек</th>
                    <th className="pb-3 font-medium text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b last:border-0 hover:bg-gray-50 ${
                        s.id === bestPerformerId && staff.length > 1 ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="py-3">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </td>
                      <td className="py-3">{ROLE_LABELS[s.role]}</td>
                      <td className="py-3 text-center">{s.leads_count}</td>
                      <td className="py-3 text-center">{s.orders_count}</td>
                      <td className="py-3 text-center">{s.orders_sent_to_factory ?? 0}</td>
                      <td className="py-3 text-center">{s.orders_completed}</td>
                      <td className="py-3 text-right font-medium">
                        {s.total_revenue.toLocaleString('ru-RU')} {'\u20B8'}
                      </td>
                      <td className="py-3 text-right">
                        {s.avg_check.toLocaleString('ru-RU')} {'\u20B8'}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => openEdit(s)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                        >
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {bestPerformerId && staff.length > 1 && (
          <p className="text-sm text-gray-500">
            * Строка с зеленым фоном -- лучший сотрудник по выручке за выбранный период.
          </p>
        )}

        {/* KPI Charts */}
        {staff.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Количество заказов</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staff.map((s) => ({ name: s.name, orders_count: s.orders_count }))}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => [`${value}`, 'Заказов']} />
                    <Bar dataKey="orders_count" name="Заказы" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Выручка</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staff.map((s) => ({ name: s.name, total_revenue: s.total_revenue }))}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString('ru-RU')} \u20B8`, 'Выручка']} />
                    <Bar dataKey="total_revenue" name="Выручка" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Редактирование сотрудника
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                >
                  <option value="admin">Администратор</option>
                  <option value="order_manager">Менеджер заявок</option>
                  <option value="client_manager">Менеджер клиентов</option>
                  <option value="delivery_manager">Технический специалист</option>
                  <option value="accountant">Бухгалтерия</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый пароль
                </label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                  placeholder="Оставьте пустым, чтобы не менять"
                />
                <p className="text-xs text-gray-400 mt-1">Минимум 4 символа. Оставьте пустым, если не хотите менять пароль.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !editForm.name.trim()}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50 font-medium"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditUser(null)}
                className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
