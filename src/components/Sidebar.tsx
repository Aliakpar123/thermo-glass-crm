'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const navItems = [
  { href: '/deals', label: 'Сделки', icon: '📋', roles: ['admin', 'order_manager', 'client_manager'] },
  { href: '/clients', label: 'Контакты', icon: '👥', roles: ['admin', 'order_manager', 'client_manager'] },
  { href: '/dashboard', label: 'Дашборд', icon: '📊', roles: ['admin'] },
  { href: '/marketing', label: 'Аналитика', icon: '📈', roles: ['admin'] },
  { href: '/staff', label: 'Сотрудники', icon: '👔', roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const [newLeadsCount, setNewLeadsCount] = useState(0);

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

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">Thermo Glass KZ</h1>
        <p className="text-gray-400 text-sm mt-1">CRM система</p>
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
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
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
