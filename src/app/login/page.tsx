'use client';

import { signIn } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { defaultLandingForCompany } from '@/lib/company-modules';

interface PublicCompany {
  id: number;
  name: string;
  slug: string;
  logo_emoji: string;
  color: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('company') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetCompany, setTargetCompany] = useState<PublicCompany | null>(null);

  // Если пришли с ?company=<slug> — покажем, в какую компанию вход
  useEffect(() => {
    if (!companySlug) return;
    fetch('/api/companies/public')
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) {
          const found = list.find((c: PublicCompany) => c.slug === companySlug);
          if (found) setTargetCompany(found);
        }
      })
      .catch(() => {});
  }, [companySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError('Неверный email или пароль');
      setLoading(false);
      return;
    }

    // Логин успешен. Если есть targetCompany — ставим её активной и идём в CRM.
    if (targetCompany) {
      try {
        const setRes = await fetch('/api/companies/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: targetCompany.id }),
        });
        if (setRes.ok) {
          router.push(defaultLandingForCompany(targetCompany.slug));
          return;
        }
        // Нет доступа к этой компании у этого пользователя
        setError(`У вас нет доступа к компании «${targetCompany.name}»`);
        setLoading(false);
        return;
      } catch {
        setError('Ошибка сети');
        setLoading(false);
        return;
      }
    }

    // Без company= — отправляем на хаб
    router.push('/select-company');
  };

  const accent = targetCompany?.color || '#22c55e';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="rounded-2xl shadow-lg border p-8 w-full max-w-sm animate-fadeIn" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm text-2xl"
              style={{ backgroundColor: targetCompany ? `${accent}20` : '#22c55e', border: targetCompany ? `1px solid ${accent}40` : 'none' }}
            >
              {targetCompany ? targetCompany.logo_emoji : '✨'}
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
            {targetCompany ? targetCompany.name : 'E1eventy'}
          </h1>
          <p className="text-gray-400 text-[13px] mt-1">
            {targetCompany ? 'Вход для сотрудников компании' : 'Вход в систему'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-[13px] border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-2 outline-none text-gray-900 text-sm transition-all duration-150 bg-white placeholder:text-gray-300"
              style={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--tw-ring-color' as any]: `${accent}33`,
              }}
              placeholder="your@email.kz"
              required
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-2 outline-none text-gray-900 text-sm transition-all duration-150 bg-white placeholder:text-gray-300"
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 rounded-lg transition-all duration-150 font-medium text-sm disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: accent }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/select-company')}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            ← Назад к E1eventy
          </button>
        </div>
      </div>
    </div>
  );
}
