'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

interface Company {
  id: number;
  name: string;
  logo_emoji: string;
  color: string;
  description: string;
}

export default function EmptyCompanyPage() {
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/companies').then((r) => r.json()),
      fetch('/api/companies/active').then((r) => r.json()),
    ]).then(([list, active]) => {
      if (Array.isArray(list) && active?.company_id) {
        const found = list.find((c: Company & { id: number }) => c.id === Number(active.company_id));
        if (found) setCompany(found);
      }
    }).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl text-center">
          {company && (
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-6xl mx-auto mb-6 shadow-lg"
              style={{ backgroundColor: `${company.color}20`, border: `1px solid ${company.color}40` }}
            >
              {company.logo_emoji}
            </div>
          )}

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {company?.name || 'Компания'}
          </h1>
          {company?.description && (
            <p className="text-gray-500 text-sm mb-8">{company.description}</p>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 mt-4">
            <div className="text-5xl mb-4">🚧</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Воркспейс пока пустой
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              CRM-модули для этой компании ещё не настроены.
              Скоро здесь появятся сделки, задачи, клиенты и аналитика — специально под процессы вашей компании.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href="/select-company"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all text-sm font-medium"
              >
                ← В E1eventy
              </Link>
              <a
                href="mailto:admin@e1eventy.kz?subject=Запрос настройки CRM"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#22c55e]/10 text-[#16a34a] rounded-lg hover:bg-[#22c55e]/20 transition-all text-sm font-medium"
              >
                ✉️ Запросить настройку
              </a>
            </div>
          </div>

          <div className="mt-6 text-xs text-gray-400">
            Чтобы попасть в рабочий CRM — вернитесь в холдинг и выберите компанию с настроенными модулями.
          </div>
        </div>
      </div>
    </Layout>
  );
}
