'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const navItems = [
  { href: '/dashboard', label: 'Дашборд', icon: '📊', roles: ['admin', 'order_manager', 'client_manager'] },
  { href: '/clients', label: 'Клиенты', icon: '👥', roles: ['admin', 'client_manager'] },
  { href: '/leads', label: 'Заявки', icon: '📥', roles: ['admin', 'order_manager'] },
  { href: '/orders', label: 'Заказы', icon: '📋', roles: ['admin', 'order_manager'] },
  { href: '/marketing', label: 'Маркетинг', icon: '📈', roles: ['admin'] },
  { href: '/staff', label: 'Сотрудники', icon: '👔', roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role || '';
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  const canSeeLeads = userRole === 'admin' || userRole === 'order_manager';

  useEffect(() => {
    if (!canSeeLeads) return;

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
  }, [canSeeLeads]);

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
              {item.href === '/leads' && canSeeLeads && newLeadsCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newLeadsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-sm text-gray-400 mb-2">{session?.user?.name}</div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left text-sm text-gray-400 hover:text-white transition px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
