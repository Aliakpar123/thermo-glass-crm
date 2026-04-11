'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import StatusBadge from '@/components/StatusBadge';
import { Lead, Order, OrderStatus, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, PRODUCT_TYPE_LABELS, ORDER_STATUS_LABELS, ROLE_LABELS, UserRole } from '@/types';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });

interface DashboardData {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  revenue_prev_month: number;
  revenue_daily: { date: string; revenue: number }[];
  new_leads: number;
  active_orders: number;
  completed_month: number;
  total_clients: number;
  funnel: {
    leads: number;
    clients: number;
    orders: number;
    completed: number;
  };
  staff_activity: { name: string; role: string; actions_today: number }[];
  overdue_orders: { id: number; client_name: string; status: string; days_since_update: number }[];
  recent_activity: { user_name: string; action: string; entity_type: string; details: string; created_at: string }[];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Simplified dashboard for non-admin roles
function SimpleDashboard() {
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
    { label: 'Новые заявки', value: String(newLeads.length), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Заказы в работе', value: String(activeOrders.length), color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Завершено за месяц', value: String(completedThisMonth.length), color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Выручка за месяц', value: revenueThisMonth.toLocaleString('ru-RU') + ' \u20B8', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const latestLeads = [...leads].sort((a, b) => b.id - a.id).slice(0, 5);
  const latestOrders = [...orders].sort((a, b) => b.id - a.id).slice(0, 5);

  if (loading) return <div className="text-gray-500">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 shadow-sm`}>
            <div className="text-sm text-gray-600 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Последние заявки</h2>
            <Link href="/leads" className="text-blue-600 text-sm hover:underline">Все заявки</Link>
          </div>
          {latestLeads.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет заявок</p>
          ) : (
            <table className="w-full text-sm text-gray-900">
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        lead.status === 'new' ? 'bg-blue-100 text-blue-800'
                        : lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800'
                        : lead.status === 'converted' ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
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

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Последние заказы</h2>
            <Link href="/orders" className="text-blue-600 text-sm hover:underline">Все заказы</Link>
          </div>
          {latestOrders.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет заказов</p>
          ) : (
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">No</th>
                  <th className="pb-2 font-medium">Продукт</th>
                  <th className="pb-2 font-medium">Сумма</th>
                  <th className="pb-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5">
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">#{order.id}</Link>
                    </td>
                    <td className="py-2.5">{PRODUCT_TYPE_LABELS[order.product_type]}</td>
                    <td className="py-2.5">{order.amount.toLocaleString('ru-RU')} {'\u20B8'}</td>
                    <td className="py-2.5"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Full admin dashboard
function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Ошибка загрузки данных'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Загрузка...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return null;

  const changePercent = data.revenue_prev_month > 0
    ? ((data.revenue_month - data.revenue_prev_month) / data.revenue_prev_month * 100).toFixed(1)
    : '0';
  const isGrowth = data.revenue_month >= data.revenue_prev_month;

  const funnelMax = Math.max(data.funnel.leads, 1);
  const funnelSteps = [
    { label: 'Заявки', value: data.funnel.leads, pct: 100 },
    { label: 'Клиенты', value: data.funnel.clients, pct: Math.round((data.funnel.clients / funnelMax) * 100) },
    { label: 'Заказы', value: data.funnel.orders, pct: Math.round((data.funnel.orders / funnelMax) * 100) },
    { label: 'Завершено', value: data.funnel.completed, pct: Math.round((data.funnel.completed / funnelMax) * 100) },
  ];

  const chartData = data.revenue_daily.map((d) => ({
    date: formatShortDate(d.date),
    revenue: d.revenue,
  }));

  return (
    <div className="space-y-6">
      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue card with % change */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500 mb-1">Выручка за месяц</div>
          <div className="text-2xl font-bold text-gray-900">
            {data.revenue_month.toLocaleString('ru-RU')} {'\u20B8'}
          </div>
          <div className={`flex items-center mt-1 text-sm font-medium ${isGrowth ? 'text-green-600' : 'text-red-600'}`}>
            <span className="mr-1">{isGrowth ? '\u2191' : '\u2193'}</span>
            <span>{changePercent}% vs пр. месяц</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500 mb-1">Новые заявки</div>
          <div className="text-2xl font-bold text-gray-900">{data.new_leads}</div>
          <div className="text-sm text-gray-400 mt-1">со статусом &laquo;Новая&raquo;</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500 mb-1">Заказы в работе</div>
          <div className="text-2xl font-bold text-gray-900">{data.active_orders}</div>
          <div className="text-sm text-gray-400 mt-1">незавершённых</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500 mb-1">Клиентов всего</div>
          <div className="text-2xl font-bold text-gray-900">{data.total_clients}</div>
          <div className="text-sm text-gray-400 mt-1">в базе</div>
        </div>
      </div>

      {/* Row 2: Revenue chart + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Выручка за 7 дней</h2>
          {chartData.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toLocaleString('ru-RU')} \u20B8`, 'Выручка']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Funnel (1/3 width) */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Воронка</h2>
          <div className="space-y-4">
            {funnelSteps.map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-sm text-gray-900 mb-1">
                  <span>{step.label}</span>
                  <span className="font-semibold">{step.value}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.max(step.pct, 2)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{step.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Overdue orders + Staff activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue orders */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Просроченные заказы</h2>
          {data.overdue_orders.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет просроченных заказов</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Заказ</th>
                  <th className="pb-2 font-medium">Клиент</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Простой</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-900">
                      <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">#{o.id}</Link>
                    </td>
                    <td className="py-2.5 text-gray-900">{o.client_name || '---'}</td>
                    <td className="py-2.5">
                      <StatusBadge status={o.status as OrderStatus} />
                    </td>
                    <td className="py-2.5 text-red-600 font-medium">
                      {o.days_since_update} дн без движения
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Staff activity */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Активность сотрудников</h2>
          {data.staff_activity.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет активности за сегодня</p>
          ) : (
            <div className="space-y-3">
              {data.staff_activity.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
                      {s.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">{ROLE_LABELS[s.role as UserRole] || s.role}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{s.actions_today} действий</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent activity log */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Последние действия</h2>
        {data.recent_activity.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет действий</p>
        ) : (
          <div className="space-y-3">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                  {a.user_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{a.user_name}</span>{' '}
                    <span>{a.action}</span>{' '}
                    <span className="text-gray-500">{a.entity_type}</span>
                  </div>
                  {a.details && (
                    <div className="text-xs text-gray-400 truncate">{a.details}</div>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">{timeAgo(a.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface OverdueNotification {
  id: number;
  next_action_date: string;
  next_action_text: string;
  status: string;
  client_name: string;
  client_phone: string;
  manager_name: string;
  days_overdue: number;
}

function OverdueBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<OverdueNotification[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id || '';
    const userRole = (session?.user as { role?: string })?.role || '';
    const params = userRole !== 'admin' && userId ? `?manager_id=${userId}` : '';
    fetch(`/api/notifications${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {});
  }, [session]);

  if (notifications.length === 0 || dismissed) return null;

  return (
    <>
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-900 min-w-0">
          <span className="text-lg flex-shrink-0">&#9888;&#65039;</span>
          <span className="truncate">
            У вас {notifications.length} просроченных задач
            {notifications.length <= 3
              ? ' — ' + notifications.map((n) => {
                  const label = n.days_overdue > 0 ? `${n.days_overdue} дн` : n.days_overdue === 0 ? 'сегодня' : 'завтра';
                  return `${n.client_name || 'Без имени'} (${label})`;
                }).join(', ')
              : ' — ' + notifications.slice(0, 2).map((n) => {
                  const label = n.days_overdue > 0 ? `${n.days_overdue} дн` : n.days_overdue === 0 ? 'сегодня' : 'завтра';
                  return `${n.client_name || 'Без имени'} (${label})`;
                }).join(', ') + '...'
            }
          </span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-1"
          >
            {showAll ? 'Скрыть' : 'Показать все'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 ml-3 text-lg leading-none flex-shrink-0"
        >
          &times;
        </button>
      </div>
      {showAll && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
          {notifications.map((n) => {
            const label = n.days_overdue > 0 ? `Просрочено ${n.days_overdue} дн` : n.days_overdue === 0 ? 'Сегодня' : 'Завтра';
            const labelColor = n.days_overdue > 0 ? 'text-red-500' : n.days_overdue === 0 ? 'text-orange-500' : 'text-yellow-500';
            const dotColor = n.days_overdue > 0 ? 'bg-red-500' : n.days_overdue === 0 ? 'bg-orange-500' : 'bg-yellow-500';
            return (
              <button
                key={n.id}
                onClick={() => router.push(`/deals/${n.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
              >
                <div className="flex items-start gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{n.client_name || 'Без имени'}</div>
                    <div className="text-xs text-gray-500 truncate">{n.next_action_text || 'Действие не указано'}</div>
                    <div className={`text-xs font-medium ${labelColor} mt-0.5`}>{label}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <OverdueBanner />
        {userRole === 'admin' ? <AdminDashboard /> : <SimpleDashboard />}
      </div>
    </Layout>
  );
}
