'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import CompanySwitcher from './CompanySwitcher';

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

// Если `companies` не задано — пункт виден во всех компаниях.
// Если задано — пункт виден только для указанных slug'ов.
type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: string[];
  companies?: string[];
};

// Пока CRM настроен только под Thermo Glass. Другие компании холдинга
// видят пустой воркспейс-заглушку, пока под них не настроят модули.
const navItems: NavItem[] = [
  { href: '/deals', label: 'Сделки', icon: '📋', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
  { href: '/deals/archive', label: 'Архив сделок', icon: '🗂️', roles: ['admin'], companies: ['thermo'] },
  { href: '/whatsapp', label: 'WhatsApp', icon: '💬', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
  { href: '/tasks', label: 'Задачи', icon: '✅', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
  { href: '/leaderboard', label: 'Рейтинг', icon: '🏆', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
  { href: '/clients', label: 'Контакты', icon: '👥', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
  { href: '/dashboard', label: 'Дашборд', icon: '📊', roles: ['admin'], companies: ['thermo'] },
  { href: '/marketing', label: 'Аналитика', icon: '📈', roles: ['admin'], companies: ['thermo'] },
  { href: '/marketing/wiki', label: 'Wiki Маркетинг', icon: '📖', roles: ['admin'], companies: ['thermo'] },
  { href: '/marketing/content', label: 'Контент', icon: '✍️', roles: ['admin'], companies: ['thermo'] },
  { href: '/staff', label: 'Сотрудники', icon: '👔', roles: ['admin'], companies: ['thermo'] },
  { href: '/finance', label: 'Финансы', icon: '💰', roles: ['admin', 'accountant'], companies: ['thermo'] },
  { href: '/settings/whatsapp', label: 'Настройки WhatsApp', icon: '⚙️', roles: ['admin'], companies: ['thermo'] },
  { href: '/semmar', label: 'Semmar Drive', icon: '📁', roles: ['admin', 'order_manager', 'client_manager', 'delivery_manager', 'accountant'], companies: ['thermo'] },
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
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [whatsappUnread, setWhatsappUnread] = useState(0);

  // WhatsApp непрочитанные
  useEffect(() => {
    if (!userRole) return;
    const fetchUnread = () => {
      fetch('/api/whatsapp/unread-count')
        .then((r) => r.json())
        .then((data) => setWhatsappUnread(Number(data.count || 0)))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [userRole]);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Slug активной компании — чтобы скрывать пункты, специфичные для Thermo
  const [activeCompanySlug, setActiveCompanySlug] = useState<string>('');
  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then((r) => r.json()).catch(() => []),
      fetch('/api/companies/active').then((r) => r.json()).catch(() => ({})),
    ]).then(([list, active]) => {
      if (Array.isArray(list) && active?.company_id) {
        const found = list.find((c: { id: number }) => c.id === Number(active.company_id));
        if (found) setActiveCompanySlug(found.slug);
      }
    });
  }, []);

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

  // Fetch task counts
  useEffect(() => {
    if (!userId) return;

    const fetchTaskCounts = () => {
      fetch(`/api/tasks?assigned_to=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setPendingTasksCount(data.length);
            setOverdueTasksCount(data.filter((t: { is_overdue?: boolean }) => t.is_overdue).length);
          }
        })
        .catch(() => {});
    };

    fetchTaskCounts();
    const interval = setInterval(fetchTaskCounts, 30000);
    return () => clearInterval(interval);
  }, [userId]);

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

  const totalBadgeCount = notifications.length + mentions.length + overdueTasksCount;

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

  const filteredNav = navItems.filter((item) => {
    if (!item.roles.includes(userRole)) return false;
    // Если у пункта задан companies whitelist — показывать только когда активная компания подходит
    if (item.companies && item.companies.length > 0) {
      if (!activeCompanySlug) return false;
      if (!item.companies.includes(activeCompanySlug)) return false;
    }
    return true;
  });

  return (
    <aside className="w-56 bg-[#111214] text-white min-h-screen flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <CompanySwitcher />
      </div>
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
          {/* Notification bell */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="relative p-1.5 rounded-lg hover:bg-white/5 transition-all duration-150"
              title="Уведомления"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {totalBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-semibold rounded-full min-w-[16px] min-h-[16px] flex items-center justify-center">
                  {totalBadgeCount}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {showPanel && (
              <div className="fixed left-56 top-4 w-80 bg-white rounded-xl shadow-2xl z-50 max-h-[400px] flex flex-col border border-gray-100">
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

                  {/* Overdue tasks section */}
                  {overdueTasksCount > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-red-50 text-xs font-semibold text-red-700 uppercase tracking-wide">
                        Просроченные задачи ({overdueTasksCount})
                      </div>
                      <button
                        onClick={() => {
                          setShowPanel(false);
                          router.push('/tasks');
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              У вас {overdueTasksCount} просроченн{overdueTasksCount === 1 ? 'ая задача' : overdueTasksCount < 5 ? 'ые задачи' : 'ых задач'}
                            </div>
                            <div className="text-xs text-red-500 mt-0.5">
                              Перейти к задачам
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {notifications.length === 0 && mentions.length === 0 && overdueTasksCount === 0 && (
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

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {filteredNav.map((item) => {
          // Исключаем более длинные соседние роуты (например /deals/archive) из подсветки /deals
          const hasLongerMatch = filteredNav.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(item.href + '/') &&
              (pathname === other.href || pathname.startsWith(other.href + '/'))
          );
          const isActive =
            !hasLongerMatch &&
            (pathname === item.href || pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px] ${
                isActive
                  ? 'bg-[#22c55e]/10 text-[#4ade80] border-l-2 border-[#4ade80]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-l-2 border-transparent'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.href === '/deals' && newLeadsCount > 0 && (
                <span className="ml-auto bg-[#22c55e] text-white text-[10px] font-semibold rounded-full w-4.5 h-4.5 flex items-center justify-center">
                  {newLeadsCount}
                </span>
              )}
              {item.href === '/whatsapp' && whatsappUnread > 0 && (
                <span className="ml-auto bg-[#25D366] text-white text-[10px] font-semibold rounded-full w-4.5 h-4.5 flex items-center justify-center px-1 min-w-[18px]">
                  {whatsappUnread}
                </span>
              )}
              {item.href === '/tasks' && pendingTasksCount > 0 && (
                <span className="ml-auto bg-[#22c55e] text-white text-[10px] font-semibold rounded-full w-4.5 h-4.5 flex items-center justify-center">
                  {pendingTasksCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        {/* Profile */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
            style={{ backgroundColor: getManagerColor(session?.user?.name || '') }}
          >
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-gray-200 truncate">{session?.user?.name}</div>
            <div className="text-[11px] text-gray-500 truncate">{(session?.user as { role?: string })?.role === 'admin' ? 'Администратор' : (session?.user as { role?: string })?.role === 'client_manager' ? 'Менеджер клиентов' : 'Менеджер заявок'}</div>
          </div>
        </div>

        {/* Settings link */}
        <Link
          href="/profile"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-all duration-150"
        >
          <span className="text-sm">&#9881;</span>
          Профиль и настройки
        </Link>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 font-medium"
        >
          <span className="text-sm">&#10140;</span>
          Выйти
        </button>
      </div>
    </aside>
  );
}
