'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import { ROLE_LABELS, UserRole } from '@/types';

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; name?: string; email?: string; role?: UserRole } | undefined;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setMessage('Минимум 4 символа');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Пароли не совпадают');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(user?.id), password }),
      });
      if (res.ok) {
        setMessage('Пароль изменён!');
        setPassword('');
        setConfirmPassword('');
      } else {
        setMessage('Ошибка при смене пароля');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Профиль и настройки</h1>

        {/* Profile card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
              <p className="text-gray-500">{user?.email}</p>
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Имя</div>
              <div className="text-gray-900 font-medium">{user?.name}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Email</div>
              <div className="text-gray-900 font-medium">{user?.email}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Роль</div>
              <div className="text-gray-900 font-medium">{user?.role ? ROLE_LABELS[user.role] : ''}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">ID</div>
              <div className="text-gray-900 font-medium">#{user?.id}</div>
            </div>
          </div>
        </div>

        {/* Change password - only admin */}
        {user?.role === 'admin' ? (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Сменить пароль</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                placeholder="Минимум 4 символа"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Повторите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] text-gray-900"
                placeholder="Повторите пароль"
              />
            </div>
            {message && (
              <div className={`text-sm ${message.includes('изменён') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition disabled:opacity-50 font-medium"
            >
              {saving ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </form>
        </div>
        ) : (
        <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-500">
          Для смены пароля обратитесь к администратору.
        </div>
        )}
      </div>
    </Layout>
  );
}
