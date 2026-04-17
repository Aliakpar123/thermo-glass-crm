'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Неверный email или пароль');
    } else {
      router.push('/select-company');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="rounded-2xl shadow-lg border p-8 w-full max-w-sm animate-fadeIn" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#22c55e] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white text-2xl">✨</span>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">E1eventy</h1>
          <p className="text-gray-400 text-[13px] mt-1">Вход в систему</p>
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none text-gray-900 text-sm transition-all duration-150 bg-white placeholder:text-gray-300"
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none text-gray-900 text-sm transition-all duration-150 bg-white placeholder:text-gray-300"
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] text-white py-2.5 rounded-lg hover:bg-[#16a34a] transition-all duration-150 font-medium text-sm disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

      </div>
    </div>
  );
}
