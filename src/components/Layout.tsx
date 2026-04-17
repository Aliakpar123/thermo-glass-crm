'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { isCompanyConfigured } from '@/lib/company-modules';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Если активная компания не настроена (нет CRM-модулей) — редирект на /empty,
  // кроме самой /empty и страницы выбора компании.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (pathname === '/empty' || pathname === '/select-company') return;

    Promise.all([
      fetch('/api/companies').then((r) => r.json()).catch(() => []),
      fetch('/api/companies/active').then((r) => r.json()).catch(() => ({})),
    ]).then(([list, active]) => {
      if (!Array.isArray(list) || !active?.company_id) return;
      const current = list.find((c: { id: number }) => c.id === Number(active.company_id));
      if (current && !isCompanyConfigured(current.slug)) {
        router.replace('/empty');
      }
    });
  }, [status, pathname, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-gray-400 text-sm">Загрузка...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--bg-primary)' }}>{children}</main>
    </div>
  );
}
