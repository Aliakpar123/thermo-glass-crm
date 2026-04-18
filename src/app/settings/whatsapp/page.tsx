'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

interface ConfigState {
  idInstance: string;
  apiTokenMasked: string;
  hasApiToken: boolean;
  webhookToken: string;
  configured: boolean;
}

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [idInstance, setIdInstance] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; state?: string; error?: string } | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetch('/api/integrations/whatsapp')
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
        } else {
          setConfig(data);
          setIdInstance(data.idInstance || '');
          setWebhookToken(data.webhookToken || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl =
    webhookToken
      ? `${baseUrl}/api/webhooks/whatsapp?token=${encodeURIComponent(webhookToken)}`
      : `${baseUrl}/api/webhooks/whatsapp?company=thermo`;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idInstance, apiToken, webhookToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Ошибка сохранения');
        return;
      }
      setSuccessMsg('Сохранено');
      setApiToken(''); // чистим поле после сохранения
      // Обновим состояние
      const updated = await fetch('/api/integrations/whatsapp').then((r) => r.json());
      setConfig(updated);
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/whatsapp/test');
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Отключить WhatsApp? Настройки сотрутся, но переписка сохранится.')) return;
    await fetch('/api/integrations/whatsapp', { method: 'DELETE' });
    setConfig(null);
    setIdInstance('');
    setApiToken('');
    setWebhookToken('');
    setSuccessMsg('Интеграция отключена');
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg('Скопировано в буфер');
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      </Layout>
    );
  }

  if (error && !config) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-red-600">
            {error}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            <span className="text-3xl">💬</span> Настройки WhatsApp
          </h1>
          <p className="text-sm text-gray-500">Подключение через Green API</p>
        </div>

        {/* Status */}
        <div className={`rounded-xl border p-5 ${config?.configured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${config?.configured ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <div className="flex-1">
              <div className={`text-sm font-semibold ${config?.configured ? 'text-green-900' : 'text-yellow-900'}`}>
                {config?.configured ? 'Интеграция настроена' : 'Интеграция не настроена'}
              </div>
              <div className={`text-xs ${config?.configured ? 'text-green-700' : 'text-yellow-700'}`}>
                {config?.configured
                  ? 'Заполнены ID Instance и API Token. Нажмите «Проверить», чтобы убедиться что WhatsApp подключён.'
                  : 'Введите ID Instance и API Token из панели Green API.'}
              </div>
            </div>
            {config?.configured && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                {testing ? 'Проверка...' : 'Проверить'}
              </button>
            )}
          </div>

          {testResult && (
            <div className={`mt-4 px-3 py-2 rounded-lg text-sm ${testResult.ok ? 'bg-white text-gray-900 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult.ok ? (
                <>
                  Статус инстанса: <strong>{testResult.state}</strong>
                  {testResult.state === 'authorized' && ' ✅ Готов к работе'}
                  {testResult.state === 'notAuthorized' && ' ⚠️ Откройте панель Green API и отсканируйте QR-код'}
                  {testResult.state === 'blocked' && ' ❌ Номер заблокирован Meta'}
                </>
              ) : (
                <>Ошибка: {testResult.error}</>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Учётные данные Green API</div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              ID Instance <span className="text-gray-400">(обязательно)</span>
            </label>
            <input
              type="text"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              placeholder="1101234567"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              API Token <span className="text-gray-400">(обязательно)</span>
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={config?.hasApiToken ? `Сохранён: ${config.apiTokenMasked}` : 'вставьте из Green API'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
            />
            <div className="text-[11px] text-gray-400 mt-1">
              Оставьте пустым чтобы не менять уже сохранённый токен
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Webhook Token <span className="text-gray-400">(придумайте свой секрет)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder="например: thermo-whatsapp-2026-secret"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setWebhookToken(`wa-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700 font-medium"
              >
                Сгенерировать
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Используется для защиты webhook URL. Тот же токен нужно указать в настройках Green API.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>
          )}
          {successMsg && !error && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-100">{successMsg}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !idInstance}
              className="px-5 py-2.5 bg-[#22c55e] text-white rounded-lg text-sm font-medium hover:bg-[#16a34a] disabled:opacity-50 transition"
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
            {config?.configured && (
              <button
                onClick={handleDisconnect}
                className="px-5 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition"
              >
                Отключить
              </button>
            )}
          </div>
        </div>

        {/* Webhook URL */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <div className="text-sm font-semibold text-gray-900">URL для webhook'а</div>
          <p className="text-xs text-gray-500">
            Скопируйте этот URL и вставьте в настройки Green API → поле «URL для получения уведомлений».
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => copy(webhookUrl)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 shrink-0"
            >
              Копировать
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-sm font-semibold text-gray-900 mb-3">📘 Как подключить за 5 минут</div>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <div>
                Зарегистрируйтесь на{' '}
                <a href="https://green-api.com/" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline font-medium">
                  green-api.com
                </a>{' '}
                (бесплатно, 3000 сообщений/мес).
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <div>
                В личном кабинете создайте инстанс (тариф Developer — бесплатный).
                Получите <strong>ID Instance</strong> и <strong>API Token</strong>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <div>
                Откройте инстанс → появится <strong>QR-код</strong>.
                На телефоне: WhatsApp → Настройки → Связанные устройства → Привязать устройство.
                Отсканируйте QR.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
              <div>
                Вставьте ID Instance и API Token в форму выше, придумайте Webhook Token,
                нажмите <strong>«Сохранить»</strong>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
              <div>
                В Green API → Настройки инстанса → вставьте наш <strong>Webhook URL</strong> (см. выше).
                Включите уведомления: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">incomingMessageReceived</code>.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#22c55e] text-white text-xs font-bold flex items-center justify-center shrink-0">6</span>
              <div>
                Вернитесь сюда, нажмите <strong>«Проверить»</strong>.
                Должен быть статус <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">authorized</code>.
                Готово!
              </div>
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}
