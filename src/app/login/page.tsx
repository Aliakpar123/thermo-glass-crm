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
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold tracking-tight">TG</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Thermo Glass KZ</h1>
          <p className="text-gray-500 mt-2">CRM система</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              placeholder="admin@thermoglass.kz"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-1">Аккаунты:</p>
          <p>Алиакбар: admin@thermoglass.kz / admin123</p>
          <p>Нуртай: nurtay@thermoglass.kz / manager123</p>
          <p>Алиакпар: aliakpar@thermoglass.kz / manager123</p>
          <p>Камилла: kamilla@thermoglass.kz / manager123</p>
          <p>Айжан: aizhan@thermoglass.kz / manager123</p>
          <p>Евгений: evgeniy@thermoglass.kz / manager123</p>
          <p>Маржан: marzhan@thermoglass.kz / manager123</p>
        </div>
      </div>
    </div>
  );
}
