'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { defaultLandingForCompany } from '@/lib/company-modules';

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

// Минималистичный акцент — красный, как на референсе
const ACCENT = '#c0392b';

export default function SelectCompanyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
            if (data.length === 1) handleSelect(data[0].id);
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
        const picked = companies.find((c) => c.id === companyId);
        router.push(defaultLandingForCompany(picked?.slug));
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-gray-500 text-sm tracking-widest uppercase">Loading</div>
      </div>
    );
  }

  const activeCompany = hoverIndex !== null ? companies[hoverIndex] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      {/* Внешняя тёмная рама как на референсе */}
      <div className="w-full max-w-7xl bg-[#eeeeee] relative overflow-hidden" style={{ aspectRatio: '16 / 10', minHeight: '600px' }}>

        {/* Top navigation */}
        <nav className="absolute top-0 left-0 right-0 px-16 pt-12 flex items-center justify-between z-20">
          <div className="flex items-center gap-12">
            <span
              className="text-[15px] font-medium cursor-default"
              style={{ color: ACCENT }}
            >
              Home
            </span>
            <button
              onClick={() => router.push('/profile')}
              className="text-[15px] font-medium text-[#1a1a1a] hover:opacity-60 transition"
            >
              Profile
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-[15px] font-medium text-[#1a1a1a] hover:opacity-60 transition"
            >
              Logout
            </button>
          </div>

          {/* Hamburger menu */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col gap-[5px] group"
            aria-label="Menu"
          >
            <span className="w-7 h-[2px]" style={{ backgroundColor: ACCENT }} />
            <span className="w-7 h-[2px]" style={{ backgroundColor: ACCENT }} />
            <span className="w-7 h-[2px]" style={{ backgroundColor: ACCENT }} />
          </button>
        </nav>

        {/* Dropdown menu */}
        {menuOpen && (
          <div
            className="absolute top-24 right-16 bg-white shadow-2xl z-30 min-w-[220px]"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Signed in as</div>
              <div className="text-sm font-medium text-[#1a1a1a]">{session?.user?.name}</div>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full text-left px-6 py-3 text-sm text-[#1a1a1a] hover:bg-gray-50 transition"
            >
              Profile & Settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full text-left px-6 py-3 text-sm hover:bg-gray-50 transition"
              style={{ color: ACCENT }}
            >
              Logout
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="absolute inset-0 px-16 pt-40 pb-16 flex flex-col justify-between">

          {/* Left: headline */}
          <div className="flex-1 flex flex-col justify-center max-w-[60%] relative z-10">
            <div className="text-[11px] tracking-[0.3em] uppercase text-gray-500 mb-6 font-medium">
              Holding · {session?.user?.name}
            </div>
            <h1 className="text-[96px] leading-[0.95] font-black text-[#1a1a1a] tracking-tight mb-4">
              E1eventy<span style={{ color: ACCENT }}>.</span>
            </h1>
            <p className="text-base text-gray-600 max-w-md leading-relaxed">
              Выберите компанию холдинга, в которой хотите работать.
              Все данные, команды и процессы — изолированы.
            </p>
          </div>

          {/* Company list — minimalist numbered list */}
          <div className="relative z-10">
            {companies.length === 0 ? (
              <div className="text-gray-400 text-sm">
                У вас нет доступа ни к одной компании. Обратитесь к администратору.
              </div>
            ) : (
              <div className="border-t border-gray-300">
                {companies.map((c, idx) => {
                  const isHover = hoverIndex === idx;
                  const isLoading = selecting === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c.id)}
                      onMouseEnter={() => setHoverIndex(idx)}
                      onMouseLeave={() => setHoverIndex(null)}
                      disabled={selecting !== null}
                      className="group w-full flex items-center gap-6 py-5 border-b border-gray-300 text-left transition-all disabled:opacity-50"
                    >
                      {/* Number */}
                      <span
                        className="text-[13px] font-medium tabular-nums w-10"
                        style={{ color: isHover ? ACCENT : '#999' }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Name */}
                      <span
                        className="text-2xl font-bold tracking-tight transition-all"
                        style={{
                          color: isHover ? ACCENT : '#1a1a1a',
                          transform: isHover ? 'translateX(8px)' : 'translateX(0)',
                        }}
                      >
                        {c.name}
                      </span>

                      {/* Role */}
                      <span className="text-[11px] uppercase tracking-widest text-gray-400 ml-4">
                        {ROLE_LABELS[c.role] || c.role}
                      </span>

                      {c.is_owner && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
                          style={{ backgroundColor: ACCENT, color: 'white' }}
                        >
                          Owner
                        </span>
                      )}

                      {/* Arrow */}
                      <span
                        className="ml-auto text-xl transition-all"
                        style={{
                          color: isHover ? ACCENT : '#999',
                          transform: isHover ? 'translateX(0)' : 'translateX(-8px)',
                          opacity: isHover ? 1 : 0.5,
                        }}
                      >
                        {isLoading ? '...' : '→'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: hovered company visual (like the lamp in the reference) */}
        {activeCompany && (
          <div className="absolute top-32 right-16 bottom-32 w-[360px] flex items-center justify-center pointer-events-none z-0 animate-fadeIn">
            <div className="text-center">
              <div
                className="text-[180px] leading-none mb-6 transition-all duration-300"
                style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.1))' }}
              >
                {activeCompany.logo_emoji}
              </div>
              <div
                className="inline-block w-16 h-[3px] mb-4"
                style={{ backgroundColor: ACCENT }}
              />
              <div className="text-[11px] uppercase tracking-[0.3em] text-gray-500 font-medium">
                {activeCompany.description || 'Company'}
              </div>
            </div>
          </div>
        )}

        {/* Bottom corner mark */}
        <div className="absolute bottom-8 right-16 text-[10px] uppercase tracking-[0.3em] text-gray-400 font-medium">
          © {new Date().getFullYear()} E1eventy
        </div>
        <div className="absolute bottom-8 left-16 text-[10px] uppercase tracking-[0.3em] text-gray-400 font-medium">
          {companies.length} Compan{companies.length === 1 ? 'y' : 'ies'}
        </div>
      </div>
    </div>
  );
}
