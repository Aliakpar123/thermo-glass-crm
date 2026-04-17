'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Company {
  id: number;
  name: string;
  slug: string;
  logo_emoji: string;
  color: string;
  role: string;
  is_owner: boolean;
}

export default function CompanySwitcher() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/companies/active').then((r) => r.json()),
    ]).then(([list, active]) => {
      if (Array.isArray(list)) setCompanies(list);
      if (active?.company_id) setActiveId(Number(active.company_id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleSwitch = async (companyId: number) => {
    if (companyId === activeId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/api/companies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      if (res.ok) {
        setActiveId(companyId);
        setOpen(false);
        router.refresh();
        // Перезагрузка нужна чтобы обновить все данные на канбане
        window.location.href = '/deals';
      }
    } finally {
      setSwitching(false);
    }
  };

  const active = companies.find((c) => c.id === activeId);
  if (companies.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-all duration-150"
        title="Переключить компанию"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: active ? `${active.color}20` : '#22c55e20' }}
        >
          {active?.logo_emoji || '🏢'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[12px] font-semibold text-gray-200 truncate">
            {active?.name || 'Компания'}
          </div>
          <div className="text-[10px] text-gray-500 truncate">
            {companies.length > 1 ? 'Переключить ▾' : 'E1eventy'}
          </div>
        </div>
      </button>

      {open && companies.length > 1 && (
        <div className="absolute left-0 right-0 top-[52px] bg-white rounded-xl shadow-2xl z-50 border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Компании E1eventy
            </div>
          </div>
          <div className="py-1 max-h-80 overflow-y-auto">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSwitch(c.id)}
                disabled={switching}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition text-left ${
                  c.id === activeId ? 'bg-[#22c55e]/5' : ''
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: `${c.color}20` }}
                >
                  {c.logo_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 truncate">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {c.is_owner ? '👑 Учредитель' : c.role}
                  </div>
                </div>
                {c.id === activeId && (
                  <span className="text-[#22c55e] text-sm">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
