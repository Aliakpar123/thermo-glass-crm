'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Company {
  id: number;
  name: string;
  slug: string;
  logo_emoji: string;
  color: string;
}

// Большая кнопка «← E1eventy» + название активной компании
// Клик возвращает на хаб E1eventy, где можно выбрать другую компанию
export default function CompanySwitcher() {
  const [active, setActive] = useState<Company | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/companies/active').then((r) => r.json()),
    ]).then(([list, activeRes]) => {
      if (Array.isArray(list) && activeRes?.company_id) {
        const found = list.find((c: Company) => c.id === Number(activeRes.company_id));
        if (found) setActive(found);
      }
    }).catch(() => {});
  }, []);

  return (
    <Link
      href="/select-company"
      className="group block rounded-xl bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border border-white/10 hover:border-white/20 p-3 transition-all duration-200"
      title="Вернуться в E1eventy — выбрать другую компанию"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base group-hover:-translate-x-0.5 transition-transform">←</span>
        <div className="flex items-center gap-1.5">
          <span className="text-base">✨</span>
          <span className="text-[13px] font-bold text-white tracking-tight">E1eventy</span>
        </div>
      </div>

      {active && (
        <div className="flex items-center gap-2 pl-1">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
            style={{ backgroundColor: `${active.color}30` }}
          >
            {active.logo_emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400">Сейчас в:</div>
            <div className="text-[12px] font-semibold text-gray-100 truncate">
              {active.name}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}
