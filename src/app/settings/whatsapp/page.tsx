'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

type Provider = 'green-api' | 'omnichat';

interface ConfigState {
  provider: Provider;
  webhookToken: string;
  greenApi: { idInstance: string; apiTokenMasked: string; hasApiToken: boolean };
  omnichat: { baseUrl: string; apiKeyMasked: string; hasApiKey: boolean; channel: string };
  configured: boolean;
}

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);

  // Common
  const [provider, setProvider] = useState<Provider>('omnichat');
  const [webhookToken, setWebhookToken] = useState('');

  // Green API fields
  const [idInstance, setIdInstance] = useState('');
  const [apiToken, setApiToken] = useState('');

  // Omnichat fields
  const [omniUrl, setOmniUrl] = useState('');
  const [omniKey, setOmniKey] = useState('');
  const [omniChannel, setOmniChannel] = useState('whatsapp');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; state?: string; provider?: string; error?: string } | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetch('/api/integrations/whatsapp')
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          return;
        }
        setConfig(data);
        setProvider(data.provider || 'omnichat');
        setWebhookToken(data.webhookToken || '');
        setIdInstance(data.greenApi?.idInstance || '');
        setOmniUrl(data.omnichat?.baseUrl || '');
        setOmniChannel(data.omnichat?.channel || 'whatsapp');
      })
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = provider === 'omnichat'
    ? (webhookToken ? `${baseUrl}/api/webhooks/omnichat?token=${encodeURIComponent(webhookToken)}` : `${baseUrl}/api/webhooks/omnichat`)
    : (webhookToken ? `${baseUrl}/api/webhooks/whatsapp?token=${encodeURIComponent(webhookToken)}` : `${baseUrl}/api/webhooks/whatsapp?company=thermo`);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          webhookToken,
          greenApi: { idInstance, apiToken },
          omnichat: { baseUrl: omniUrl, apiKey: omniKey, channel: omniChannel },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Ошибка сохранения');
        return;
      }
      setSuccessMsg('Сохранено');
      setApiToken('');
      setOmniKey('');
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
    if (!confirm('Отключить WhatsApp? Настройки сотрутся, переписка сохранится.')) return;
    await fetch('/api/integrations/whatsapp', { method: 'DELETE' });
    setConfig(null);
    setIdInstance('');
    setApiToken('');
    setOmniUrl('');
    setOmniKey('');
    setWebhookToken('');
    setSuccessMsg('Интеграция отключена');
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg('Скопировано');
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  if (loading) {
    return <Layout><div className="text-center py-12 text-gray-400">Загрузка...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
            <span className="text-3xl">💬</span> Настройки WhatsApp
          </h1>
          <p className="text-sm text-gray-500">Выберите провайдера и подключите мессенджер</p>
        </div>

        {/* Status */}
        <div className={`rounded-xl border p-5 ${config?.configured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${config?.configured ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <div className="flex-1">
              <div className={`text-sm font-semibold ${config?.configured ? 'text-green-900' : 'text-yellow-900'}`}>
                {config?.configured ? `Подключено через ${provider === 'omnichat' ? 'Omnichat' : 'Green API'}` : 'Не подключено'}
              </div>
              <div className={`text-xs ${config?.configured ? 'text-green-700' : 'text-yellow-700'}`}>
                {config?.configured ? 'Проверьте соединение кнопкой «Проверить»' : 'Заполните данные ниже и сохраните'}
              </div>
            </div>
            {config?.configured && (
              <button onClick={handleTest} disabled={testing} className="px-4 py-2 bg-white border border-green-300 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50">
                {testing ? 'Проверка...' : 'Проверить'}
              </button>
            )}
          </div>
          {testResult && (
            <div className={`mt-4 px-3 py-2 rounded-lg text-sm ${testResult.ok ? 'bg-white text-gray-900 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult.ok ? <>Состояние: <strong>{testResult.state}</strong> ({testResult.provider})</> : <>Ошибка: {testResult.error}</>}
            </div>
          )}
        </div>

        {/* Provider tabs */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setProvider('omnichat')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                provider === 'omnichat' ? 'bg-gray-50 text-gray-900 border-b-2 border-[#22c55e]' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              🏠 Omnichat <span className="text-[10px] text-gray-400 ml-1">свой шлюз</span>
            </button>
            <button
              onClick={() => setProvider('green-api')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                provider === 'green-api' ? 'bg-gray-50 text-gray-900 border-b-2 border-[#22c55e]' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              🟢 Green API <span className="text-[10px] text-gray-400 ml-1">3000/мес free</span>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {provider === 'omnichat' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    URL Omnichat <span className="text-gray-400">(без слеша в конце)</span>
                  </label>
                  <input
                    type="url"
                    value={omniUrl}
                    onChange={(e) => setOmniUrl(e.target.value)}
                    placeholder="https://omnichat.thermo-glass.kz"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={omniKey}
                    onChange={(e) => setOmniKey(e.target.value)}
                    placeholder={config?.omnichat?.hasApiKey ? `Сохранён: ${config.omnichat.apiKeyMasked}` : 'вставьте из Omnichat'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                  <div className="text-[11px] text-gray-400 mt-1">
                    Bearer-токен, с которым CRM обращается к Omnichat API
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Канал по умолчанию</label>
                  <select
                    value={omniChannel}
                    onChange={(e) => setOmniChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram Direct</option>
                  </select>
                </div>
              </>
            )}

            {provider === 'green-api' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">ID Instance</label>
                  <input
                    type="text"
                    value={idInstance}
                    onChange={(e) => setIdInstance(e.target.value)}
                    placeholder="1101234567"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">API Token</label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder={config?.greenApi?.hasApiToken ? `Сохранён: ${config.greenApi.apiTokenMasked}` : 'из Green API'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Webhook Token <span className="text-gray-400">(секрет для защиты webhook URL)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  placeholder="thermo-wa-secret-2026"
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
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
            {successMsg && !error && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-100">{successMsg}</div>}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-[#22c55e] text-white rounded-lg text-sm font-medium hover:bg-[#16a34a] disabled:opacity-50 transition">
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </button>
              {config?.configured && (
                <button onClick={handleDisconnect} className="px-5 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">
                  Отключить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <div className="text-sm font-semibold text-gray-900">
            Webhook URL {provider === 'omnichat' ? 'для Omnichat' : 'для Green API'}
          </div>
          <p className="text-xs text-gray-500">
            {provider === 'omnichat'
              ? 'Настройте в Omnichat: когда приходит входящее сообщение — пусть отправит POST на этот URL.'
              : 'Вставьте в Green API → Настройки инстанса → «URL для получения уведомлений».'}
          </p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
              {webhookUrl}
            </code>
            <button onClick={() => copy(webhookUrl)} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 shrink-0">
              Копировать
            </button>
          </div>
        </div>

        {/* Contract for Omnichat */}
        {provider === 'omnichat' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900 mb-3">📋 Контракт Omnichat ↔ CRM</div>
            <p className="text-xs text-gray-500 mb-4">
              Omnichat должен реализовать два эндпоинта. Токен из настроек шлётся в заголовке <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded">Authorization: Bearer &lt;API Key&gt;</code>.
            </p>

            <div className="space-y-5 text-sm">
              <div>
                <div className="font-medium text-gray-900 mb-1.5">1️⃣ Отправка сообщения (CRM → Omnichat)</div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto">
{`POST ${omniUrl || '<OMNICHAT_URL>'}/api/messages/send
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "channel": "whatsapp",
  "to": "+77011234567",
  "text": "Здравствуйте!"
}

Response: { "ok": true, "message_id": "..." }`}
                </pre>
              </div>

              <div>
                <div className="font-medium text-gray-900 mb-1.5">2️⃣ Health-check (для кнопки «Проверить»)</div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto">
{`GET ${omniUrl || '<OMNICHAT_URL>'}/api/health
Authorization: Bearer <API_KEY>

Response: { "status": "ok" }`}
                </pre>
              </div>

              <div>
                <div className="font-medium text-gray-900 mb-1.5">3️⃣ Входящее сообщение (Omnichat → CRM)</div>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "channel": "whatsapp",
  "direction": "in",
  "from": {
    "phone": "+77011234567",
    "name": "Иван",
    "id": "77011234567@c.us"
  },
  "text": "Привет",
  "message_id": "omnichat-123",
  "media_url": "https://..."   // опционально
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Quick guide */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-sm font-semibold text-gray-900 mb-3">📘 Быстрый старт</div>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            {provider === 'omnichat' ? (
              <>
                <li>В Omnichat подключи WhatsApp (Meta Cloud API) или Instagram — это его задача.</li>
                <li>В Omnichat создай API Key для внешних клиентов (CRM).</li>
                <li>Вставь URL и API Key Omnichat сюда → «Сохранить».</li>
                <li>Скопируй наш Webhook URL (выше) и настрой Omnichat чтобы он слал туда входящие.</li>
                <li>Нажми «Проверить» — должен быть <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">ok</code>.</li>
              </>
            ) : (
              <>
                <li>Зарегистрируйся на <a href="https://green-api.com/" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline">green-api.com</a>.</li>
                <li>Создай инстанс, получи ID Instance и API Token.</li>
                <li>Отсканируй QR на телефоне (WhatsApp → Связанные устройства).</li>
                <li>Вставь ID + Token сюда → «Сохранить».</li>
                <li>Скопируй Webhook URL и вставь в Green API → Настройки.</li>
                <li>Нажми «Проверить» — статус <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">authorized</code>.</li>
              </>
            )}
          </ol>
        </div>
      </div>
    </Layout>
  );
}
