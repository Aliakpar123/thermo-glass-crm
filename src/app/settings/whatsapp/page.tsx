'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

type Provider = 'meta-cloud' | 'green-api' | 'omnichat';

interface ConfigState {
  provider: Provider;
  webhookToken: string;
  metaCloud: {
    phoneNumberId: string;
    accessTokenMasked: string;
    hasAccessToken: boolean;
    appSecretMasked: string;
    hasAppSecret: boolean;
    verifyToken: string;
    wabaId: string;
  };
  greenApi: { idInstance: string; apiTokenMasked: string; hasApiToken: boolean };
  omnichat: { baseUrl: string; apiKeyMasked: string; hasApiKey: boolean; channel: string };
  configured: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  'meta-cloud': 'Meta Cloud API',
  'green-api': 'Green API',
  'omnichat': 'Omnichat',
};

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState<Provider>('meta-cloud');
  const [webhookToken, setWebhookToken] = useState('');

  // Meta Cloud
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [wabaId, setWabaId] = useState('');

  // Green API
  const [idInstance, setIdInstance] = useState('');
  const [apiToken, setApiToken] = useState('');

  // Omnichat
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
        if (data?.error) { setError(data.error); return; }
        setConfig(data);
        setProvider(data.provider || 'meta-cloud');
        setWebhookToken(data.webhookToken || '');
        setPhoneNumberId(data.metaCloud?.phoneNumberId || '');
        setVerifyToken(data.metaCloud?.verifyToken || '');
        setWabaId(data.metaCloud?.wabaId || '');
        setIdInstance(data.greenApi?.idInstance || '');
        setOmniUrl(data.omnichat?.baseUrl || '');
        setOmniChannel(data.omnichat?.channel || 'whatsapp');
      })
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl =
    provider === 'meta-cloud'
      ? `${baseUrl}/api/webhooks/whatsapp-meta`
      : provider === 'omnichat'
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
          metaCloud: { phoneNumberId, accessToken, appSecret, verifyToken, wabaId },
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
      setAccessToken(''); setAppSecret(''); setApiToken(''); setOmniKey('');
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
    setPhoneNumberId(''); setAccessToken(''); setAppSecret(''); setVerifyToken(''); setWabaId('');
    setIdInstance(''); setApiToken('');
    setOmniUrl(''); setOmniKey('');
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
                {config?.configured ? `Подключено через ${PROVIDER_LABELS[provider]}` : 'Не подключено'}
              </div>
              <div className={`text-xs ${config?.configured ? 'text-green-700' : 'text-yellow-700'}`}>
                {config?.configured ? 'Проверьте соединение кнопкой «Проверить»' : 'Заполните данные и сохраните'}
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
              onClick={() => setProvider('meta-cloud')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                provider === 'meta-cloud' ? 'bg-gray-50 text-gray-900 border-b-2 border-[#22c55e]' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              📘 Meta Cloud API <span className="text-[10px] text-gray-400 ml-1">официально, бесплатно</span>
            </button>
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
              🟢 Green API <span className="text-[10px] text-gray-400 ml-1">QR-код</span>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {provider === 'meta-cloud' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Phone Number ID <span className="text-gray-400">(из Meta App → WhatsApp → API Setup)</span>
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="412345678901234"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Access Token <span className="text-gray-400">(System User permanent token)</span>
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={config?.metaCloud?.hasAccessToken ? `Сохранён: ${config.metaCloud.accessTokenMasked}` : 'EAAxxxxxxxxxxxxxxx'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                  <div className="text-[11px] text-gray-400 mt-1">
                    Оставьте пустым чтобы не менять уже сохранённый токен
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Verify Token <span className="text-gray-400">(свой секрет)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        placeholder="thermo-meta-verify"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setVerifyToken(`meta-${Math.random().toString(36).slice(2, 10)}`)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700 font-medium"
                      >
                        ↻
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Его же впишите в Meta → Webhook
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      App Secret <span className="text-gray-400">(опц., для X-Hub-Signature)</span>
                    </label>
                    <input
                      type="password"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder={config?.metaCloud?.hasAppSecret ? `Сохранён: ${config.metaCloud.appSecretMasked}` : 'abc123…'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    WABA ID <span className="text-gray-400">(опц., WhatsApp Business Account ID)</span>
                  </label>
                  <input
                    type="text"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    placeholder="1252629676770170"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
                </div>
              </>
            )}

            {provider === 'omnichat' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">URL Omnichat</label>
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
                    placeholder={config?.omnichat?.hasApiKey ? `Сохранён: ${config.omnichat.apiKeyMasked}` : 'Bearer-токен'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#22c55e]/20 focus:border-[#22c55e] outline-none font-mono"
                  />
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

            {/* Webhook token нужен только для Green API / Omnichat — Meta использует verifyToken выше */}
            {provider !== 'meta-cloud' && (
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
            )}

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
            Webhook URL для {PROVIDER_LABELS[provider]}
          </div>
          <p className="text-xs text-gray-500">
            {provider === 'meta-cloud' && (
              <>В Meta App → WhatsApp → Configuration → Webhook: вставьте этот URL и Verify Token из поля выше. Подпишитесь на поле <code className="text-[11px] bg-gray-100 px-1 py-0.5 rounded">messages</code>.</>
            )}
            {provider === 'omnichat' && 'В Omnichat настройте: при входящем сообщении отправить POST на этот URL.'}
            {provider === 'green-api' && 'Вставьте в Green API → Настройки инстанса → «URL для получения уведомлений».'}
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

        {/* Meta instructions */}
        {provider === 'meta-cloud' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900 mb-3">📘 Как получить данные Meta</div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  Открой <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline font-medium">developers.facebook.com/apps</a> → создай приложение типа <strong>«Business»</strong>, привяжи к бизнес-портфолио.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  В приложении → <strong>«Добавить продукт» → «WhatsApp»</strong> → <strong>«API Setup»</strong>.
                  Там увидишь <strong>Phone Number ID</strong>, <strong>WhatsApp Business Account ID</strong> и <strong>Temporary Access Token</strong> (24 ч — годится для теста).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  Для <strong>постоянного токена</strong>: Business Settings → Системные пользователи → создай «Thermo CRM» → добавь WhatsApp актив → сгенерируй токен (Never expire) с разрешениями <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">whatsapp_business_messaging</code> и <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">whatsapp_business_management</code>.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                <div>
                  Вставь Phone Number ID и Access Token в форму выше, сгенерируй Verify Token (или придумай свой) → «Сохранить».
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
                <div>
                  В Meta App → WhatsApp → Configuration → <strong>Webhook</strong> → «Edit»:
                  <br/>• <strong>Callback URL</strong>: скопируй наш URL выше
                  <br/>• <strong>Verify Token</strong>: тот же, что ты ввёл в форму
                  <br/>• Нажми <strong>«Verify and Save»</strong> — Meta пришлёт handshake, CRM его подтвердит.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">6</span>
                <div>
                  В том же разделе → <strong>«Manage»</strong> → подпишись на поле <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">messages</code>.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0">7</span>
                <div>
                  Вернись сюда → «Проверить». Должно показать имя номера и качество (quality rating).
                </div>
              </li>
            </ol>
          </div>
        )}
      </div>
    </Layout>
  );
}
