'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface Company {
  id: number;
  name: string;
  slug: string;
  logo_emoji: string;
  color: string;
  description: string;
  role: string;
  is_owner: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  client_manager: 'Менеджер клиентов',
  order_manager: 'Менеджер заказов',
  delivery_manager: 'Менеджер доставки',
  accountant: 'Бухгалтер',
  employee: 'Сотрудник',
};

export default function SelectCompanyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      fetch('/api/companies')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCompanies(data);
            // Если только одна компания — сразу её выбираем
            if (data.length === 1) {
              handleSelect(data[0].id);
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (companyId: number) => {
    setSelecting(companyId);
    try {
      const res = await fetch('/api/companies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      if (res.ok) {
        router.push('/deals');
      } else {
        alert('Не удалось выбрать компанию');
        setSelecting(null);
      }
    } catch {
      setSelecting(null);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-4xl">✨</span>
            <h1 className="text-3xl font-bold text-gray-900">E1eventy</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Привет, <span className="font-medium text-gray-700">{session?.user?.name}</span>! Выберите компанию, в которую хотите войти
          </p>
        </div>

        {/* Companies grid */}
        {companies.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🏢</div>
            <div className="text-gray-600 mb-2">У вас нет доступа ни к одной компании</div>
            <div className="text-sm text-gray-400">Обратитесь к администратору</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                disabled={selecting !== null}
                className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-sm"
                    style={{ backgroundColor: `${c.color}15` }}
                  >
                    {c.logo_emoji}
                  </div>
                  {c.is_owner && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      👑 Учредитель
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#22c55e] transition">
                  {c.name}
                </div>
                <div className="text-xs text-gray-500 mb-3 line-clamp-2 min-h-[32px]">
                  {c.description || '—'}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-600 font-medium">
                    {ROLE_LABELS[c.role] || c.role}
                  </span>
                  <span className="text-sm text-gray-400 group-hover:text-[#22c55e] group-hover:translate-x-1 transition-all">
                    →
                  </span>
                </div>
                {selecting === c.id && (
                  <div className="mt-3 text-xs text-[#22c55e] font-medium">Вход...</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
