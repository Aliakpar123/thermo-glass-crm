'use client';

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
