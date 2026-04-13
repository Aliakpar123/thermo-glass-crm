'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface Notification {
  id: number;
  next_action_date: string;
  next_action_text: string;
  status: string;
  client_name: string;
  client_phone: string;
  manager_name: string;
  days_overdue: number;
}

interface MentionNotification {
  id: number;
  user_id: number;
  from_user_name: string;
  deal_id: number | null;
  client_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

const navItems = [
  { href: '/deals', label: 'Сделки', icon: '📋', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'] },
  { href: '/clients', label: 'Контакты', icon: '👥', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'] },
  { href: '/dashboard', label: 'Дашборд', icon: '📊', roles: ['admin'] },
  { href: '/marketing', label: 'Аналитика', icon: '📈', roles: ['admin'] },
  { href: '/marketing/wiki', label: 'Wiki Маркетинг', icon: '📖', roles: ['admin'] },
  { href: '/marketing/content', label: 'Контент', icon: '✍️', roles: ['admin'] },
  { href: '/staff', label: 'Сотрудники', icon: '👔', roles: ['admin'] },
  { href: '/finance', label: 'Финансы', icon: '💰', roles: ['admin', 'accountant'] },
  { href: '/semmar', label: 'Semmar', icon: '📁', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'] },
];

const MANAGER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getManagerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MANAGER_COLORS[Math.abs(hash) % MANAGER_COLORS.length];
}

function getNotificationLabel(daysOverdue: number): { text: string; color: string } {
  if (daysOverdue > 0) {
    return { text: `Просрочено ${daysOverdue} дн`, color: 'text-red-500' };
  }
  if (daysOverdue === 0) {
    return { text: 'Сегодня', color: 'text-orange-500' };
  }
  return { text: 'Завтра', color: 'text-yellow-500' };
}

function getNotificationDot(daysOverdue: number): string {
  if (daysOverdue > 0) return 'bg-red-500';
  if (daysOverdue === 0) return 'bg-orange-500';
  return 'bg-yellow-500';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const userId = (session?.user as { id?: string })?.id || '';
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userRole) return;

    const fetchCount = () => {
      fetch('/api/leads?status=new')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setNewLeadsCount(data.length);
        })
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // Fetch notifications
  useEffect(() => {
    if (!userRole) return;

    const fetchNotifications = () => {
      const params = userRole !== 'admin' && userId ? `?manager_id=${userId}` : '';
      fetch(`/api/notifications${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setNotifications(data);
        })
        .catch(() => {});
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userRole, userId]);

  // Fetch mention notifications
  useEffect(() => {
    if (!userId) return;

    const fetchMentions = () => {
      fetch(`/api/mentions?user_id=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setMentions(data);
        })
        .catch(() => {});
    };

    fetchMentions();
    const interval = setInterval(fetchMentions, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleMarkMentionRead = async (mentionId: number) => {
    try {
      await fetch('/api/mentions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mentionId }),
      });
      setMentions((prev) => prev.filter((m) => m.id !== mentionId));
    } catch {
      // ignore
    }
  };

  const totalBadgeCount = notifications.length + mentions.length;

  // Close panel on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    }
    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPanel]);

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Thermo Glass KZ</h1>
            <p className="text-gray-400 text-sm mt-1">CRM система</p>
          </div>
          {/* Notification bell */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="relative p-2 rounded-lg hover:bg-gray-800 transition"
              title="Уведомления"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {totalBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center">
                  {totalBadgeCount}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {showPanel && (
              <div className="fixed left-64 top-4 w-80 bg-white rounded-xl shadow-2xl z-50 max-h-[400px] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">
                    Уведомления ({totalBadgeCount})
                  </span>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {/* Mentions section */}
                  {mentions.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-blue-50 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Упоминания ({mentions.length})
                      </div>
                      {mentions.map((m) => (
                        <button
                          key={`mention-${m.id}`}
                          onClick={() => {
                            handleMarkMentionRead(m.id);
                            setShowPanel(false);
                            if (m.client_id) {
                              router.push(`/clients/${m.client_id}`);
                            } else if (m.deal_id) {
                              router.push(`/deals/${m.deal_id}`);
                            }
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                @{m.from_user_name} упомянул вас
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {m.message}
                              </div>
                              <div className="text-xs text-blue-500 mt-0.5">
                                {new Date(m.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {notifications.length === 0 && mentions.length === 0 && (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Нет уведомлений
                    </div>
                  )}

                  {/* Overdue tasks section header */}
                  {notifications.length > 0 && mentions.length > 0 && (
                    <div className="px-4 py-2 bg-orange-50 text-xs font-semibold text-orange-700 uppercase tracking-wide">
                      Просроченные ({notifications.length})
                    </div>
                  )}
                  {notifications.length > 0 && (
                    notifications.map((n) => {
                      const label = getNotificationLabel(n.days_overdue);
                      const dotColor = getNotificationDot(n.days_overdue);
                      return (
                        <button
                          key={n.id}
                          onClick={() => {
                            setShowPanel(false);
                            router.push(`/deals/${n.id}`);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {n.client_name || 'Без имени'}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {n.next_action_text || 'Действие не указано'}
                              </div>
                              <div className={`text-xs font-medium ${label.color} mt-0.5`}>
                                {label.text}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {item.href === '/deals' && newLeadsCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newLeadsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-2">
        {/* Profile */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: getManagerColor(session?.user?.name || '') }}
          >
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{session?.user?.name}</div>
            <div className="text-xs text-gray-400 truncate">{(session?.user as { role?: string })?.role === 'admin' ? 'Администратор' : (session?.user as { role?: string })?.role === 'client_manager' ? 'Менеджер клиентов' : 'Менеджер заявок'}</div>
          </div>
        </div>

        {/* Settings link */}
        <Link
          href="/profile"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
        >
          <span className="text-lg">&#9881;</span>
          Профиль и настройки
        </Link>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition font-medium"
        >
          <span className="text-lg">&#10140;</span>
          Выйти
        </button>
      </div>
    </aside>
  );
}
