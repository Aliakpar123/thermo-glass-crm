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
        <div className="absolute inset-0 px-16 pt-40 pb-16 flex flex-col justify-center">

          {/* Headline */}
          <div className="max-w-[55%] relative z-10">
            <div className="text-[11px] tracking-[0.3em] uppercase text-gray-500 mb-6 font-medium">
              Holding
            </div>
            <h1 className="text-[96px] leading-[0.95] font-black text-[#1a1a1a] tracking-tight mb-4">
              E1eventy<span style={{ color: ACCENT }}>.</span>
            </h1>
            <p className="text-base text-gray-600 max-w-md leading-relaxed">
              Выберите компанию холдинга, в которой хотите работать.
              Все данные, команды и процессы — изолированы.
            </p>
          </div>
        </div>

        {/* RIGHT: companies as a simple vertical list of buttons */}
        {companies.length > 0 && (
          <div className="absolute right-16 top-1/2 -translate-y-1/2 z-10 w-[320px]">
            <div className="text-[10px] tracking-[0.3em] uppercase text-gray-500 font-semibold mb-4">
              Компании
            </div>
            <div className="space-y-2">
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
                    className="group w-full flex items-center gap-4 bg-white border border-gray-300 px-4 py-3 text-left transition-all disabled:opacity-50"
                    style={{
                      borderColor: isHover ? ACCENT : '#d1d5db',
                    }}
                  >
                    <span className="text-2xl shrink-0">{c.logo_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-bold tracking-tight truncate transition"
                        style={{ color: isHover ? ACCENT : '#1a1a1a' }}
                      >
                        {c.name}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">
                        {ROLE_LABELS[c.role] || c.role}
                        {c.is_owner && <span className="ml-2" style={{ color: ACCENT }}>· Owner</span>}
                      </div>
                    </div>
                    <span
                      className="text-lg transition-all"
                      style={{
                        color: isHover ? ACCENT : '#999',
                        transform: isHover ? 'translateX(2px)' : 'translateX(0)',
                      }}
                    >
                      {isLoading ? '…' : '→'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {companies.length === 0 && (
          <div className="absolute right-16 top-1/2 -translate-y-1/2 text-gray-400 text-sm z-10">
            У вас нет доступа ни к одной компании. Обратитесь к администратору.
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
