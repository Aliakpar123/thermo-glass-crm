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
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#22c55e]/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-3xl translate-y-1/2" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Header — большой E1eventy */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-6xl">✨</span>
            <h1 className="text-6xl font-black text-white tracking-tight">E1eventy</h1>
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-[0.3em] mb-6 font-semibold">Холдинг · Holding Group</div>
          <p className="text-gray-300 text-base">
            Добро пожаловать, <span className="font-semibold text-white">{session?.user?.name}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Выберите компанию, в которую хотите войти
          </p>
        </div>

        {/* Companies grid */}
        {companies.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-12 text-center border border-white/10">
            <div className="text-5xl mb-4">🏢</div>
            <div className="text-gray-300 mb-2">У вас нет доступа ни к одной компании</div>
            <div className="text-sm text-gray-500">Обратитесь к администратору</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                disabled={selecting !== null}
                className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-7 border border-white/10 hover:border-white/30 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  boxShadow: `0 0 0 0 ${c.color}00`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 10px 40px -10px ${c.color}60`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 0 ${c.color}00`;
                }}
              >
                {/* Gradient accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, ${c.color}, transparent)` }}
                />

                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
                    style={{ backgroundColor: `${c.color}25`, border: `1px solid ${c.color}40` }}
                  >
                    {c.logo_emoji}
                  </div>
                  {c.is_owner && (
                    <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
                      👑 Учредитель
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-white mb-1.5 group-hover:text-[#4ade80] transition">
                  {c.name}
                </div>
                <div className="text-xs text-gray-400 mb-4 line-clamp-2 min-h-[32px]">
                  {c.description || '—'}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-xs text-gray-400 font-medium">
                    {ROLE_LABELS[c.role] || c.role}
                  </span>
                  <span className="text-sm text-gray-400 group-hover:text-[#4ade80] group-hover:translate-x-1 transition-all font-bold">
                    Войти →
                  </span>
                </div>
                {selecting === c.id && (
                  <div className="mt-3 text-xs text-[#4ade80] font-medium">Вход...</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
