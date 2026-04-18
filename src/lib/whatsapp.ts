// WhatsApp helpers — поддерживают трёх провайдеров:
//   1. meta-cloud — официальный Meta WhatsApp Cloud API (graph.facebook.com)
//   2. green-api  — https://green-api.com (QR-код, быстрый старт)
//   3. omnichat   — собственный шлюз пользователя
// Конфиг хранится в company_integrations.config_json с полем provider.

import getDb from '@/lib/db';

const GREEN_BASE = 'https://api.green-api.com';
const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type WhatsAppProvider = 'meta-cloud' | 'green-api' | 'omnichat';

export interface MetaCloudCreds {
  phoneNumberId: string;   // ID номера в Meta
  accessToken: string;     // Long-lived или System User token
  appSecret: string;       // App Secret (для подписи webhook'ов) — опционально
  verifyToken: string;     // Verify Token для GET-handshake от Meta
  wabaId?: string;         // WhatsApp Business Account ID — информационно
}

export interface GreenApiCreds {
  idInstance: string;
  apiToken: string;
}

export interface OmnichatCreds {
  baseUrl: string;
  apiKey: string;
  channel: string;
}

export interface WhatsAppConfig {
  provider: WhatsAppProvider;
  webhookToken: string;
  metaCloud?: MetaCloudCreds;
  greenApi?: GreenApiCreds;
  omnichat?: OmnichatCreds;
}

/** Получить конфиг для активной компании. */
export async function getWhatsAppConfigForCompany(companyId: number): Promise<WhatsAppConfig> {
  const sql = await getDb();
  try {
    const rows = await sql`
      SELECT config_json FROM company_integrations
      WHERE company_id = ${companyId} AND integration_type = 'whatsapp' AND enabled = true
      LIMIT 1
    `;
    if (rows.length > 0) {
      const cfg = JSON.parse(String(rows[0].config_json || '{}'));
      return normalizeConfig(cfg);
    }
  } catch {
    /* fallthrough */
  }
  // env fallback (green-api)
  return normalizeConfig({
    provider: 'green-api',
    webhookToken: process.env.GREEN_API_WEBHOOK_TOKEN || '',
    greenApi: {
      idInstance: process.env.GREEN_API_ID_INSTANCE || '',
      apiToken: process.env.GREEN_API_TOKEN || '',
    },
  });
}

function normalizeConfig(raw: Record<string, unknown>): WhatsAppConfig {
  const provider = (raw.provider as WhatsAppProvider) ||
    (raw.idInstance ? 'green-api' : 'green-api');
  return {
    provider,
    webhookToken: String(raw.webhookToken || ''),
    metaCloud: {
      phoneNumberId: String((raw.metaCloud as Record<string, unknown>)?.phoneNumberId || ''),
      accessToken: String((raw.metaCloud as Record<string, unknown>)?.accessToken || ''),
      appSecret: String((raw.metaCloud as Record<string, unknown>)?.appSecret || ''),
      verifyToken: String((raw.metaCloud as Record<string, unknown>)?.verifyToken || ''),
      wabaId: String((raw.metaCloud as Record<string, unknown>)?.wabaId || ''),
    },
    greenApi: {
      idInstance: String((raw.greenApi as Record<string, unknown>)?.idInstance || raw.idInstance || ''),
      apiToken: String((raw.greenApi as Record<string, unknown>)?.apiToken || raw.apiToken || ''),
    },
    omnichat: {
      baseUrl: String((raw.omnichat as Record<string, unknown>)?.baseUrl || ''),
      apiKey: String((raw.omnichat as Record<string, unknown>)?.apiKey || ''),
      channel: String((raw.omnichat as Record<string, unknown>)?.channel || 'whatsapp'),
    },
  };
}

export function isConfigured(cfg: WhatsAppConfig): boolean {
  if (cfg.provider === 'meta-cloud') {
    return Boolean(cfg.metaCloud?.phoneNumberId && cfg.metaCloud?.accessToken);
  }
  if (cfg.provider === 'green-api') {
    return Boolean(cfg.greenApi?.idInstance && cfg.greenApi?.apiToken);
  }
  if (cfg.provider === 'omnichat') {
    return Boolean(cfg.omnichat?.baseUrl && cfg.omnichat?.apiKey);
  }
  return false;
}

/** Найти компанию по webhook_token (используется для любого провайдера). */
export async function findCompanyByWebhookToken(token: string): Promise<number | null> {
  if (!token) return null;
  const sql = await getDb();
  try {
    const rows = await sql`
      SELECT company_id, config_json FROM company_integrations
      WHERE integration_type = 'whatsapp' AND enabled = true
    `;
    for (const r of rows) {
      try {
        const cfg = JSON.parse(String(r.config_json || '{}'));
        if (cfg.webhookToken === token) return Number(r.company_id);
      } catch { /* skip */ }
    }
  } catch { /* fallthrough */ }
  return null;
}

/** Найти компанию по Meta verify_token (отдельно для Meta GET handshake). */
export async function findCompanyByMetaVerifyToken(token: string): Promise<{ companyId: number; cfg: WhatsAppConfig } | null> {
  if (!token) return null;
  const sql = await getDb();
  try {
    const rows = await sql`
      SELECT company_id, config_json FROM company_integrations
      WHERE integration_type = 'whatsapp' AND enabled = true
    `;
    for (const r of rows) {
      try {
        const cfg = normalizeConfig(JSON.parse(String(r.config_json || '{}')));
        if (cfg.provider === 'meta-cloud' && cfg.metaCloud?.verifyToken === token) {
          return { companyId: Number(r.company_id), cfg };
        }
      } catch { /* skip */ }
    }
  } catch { /* fallthrough */ }
  return null;
}

/** Найти компанию по Meta phoneNumberId (для входящих сообщений). */
export async function findCompanyByMetaPhoneNumberId(phoneNumberId: string): Promise<{ companyId: number; cfg: WhatsAppConfig } | null> {
  if (!phoneNumberId) return null;
  const sql = await getDb();
  try {
    const rows = await sql`
      SELECT company_id, config_json FROM company_integrations
      WHERE integration_type = 'whatsapp' AND enabled = true
    `;
    for (const r of rows) {
      try {
        const cfg = normalizeConfig(JSON.parse(String(r.config_json || '{}')));
        if (cfg.provider === 'meta-cloud' && cfg.metaCloud?.phoneNumberId === phoneNumberId) {
          return { companyId: Number(r.company_id), cfg };
        }
      } catch { /* skip */ }
    }
  } catch { /* fallthrough */ }
  return null;
}

// ───────────────── Отправка сообщений ─────────────────

export async function sendWhatsAppText(
  cfg: WhatsAppConfig,
  chatId: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isConfigured(cfg)) return { ok: false, error: 'WhatsApp не настроен' };

  if (cfg.provider === 'meta-cloud') return sendViaMetaCloud(cfg.metaCloud!, chatId, message);
  if (cfg.provider === 'green-api') return sendViaGreenApi(cfg.greenApi!, chatId, message);
  if (cfg.provider === 'omnichat') return sendViaOmnichat(cfg.omnichat!, chatId, message);

  return { ok: false, error: `Unknown provider: ${cfg.provider}` };
}

async function sendViaMetaCloud(
  creds: MetaCloudCreds,
  chatId: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    // Meta принимает номер без '+', без '@c.us'
    const to = (phoneFromChatId(chatId) || chatId).replace(/\D/g, '');
    const res = await fetch(`${META_GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Meta HTTP ${res.status}: ${errText.slice(0, 300)}` };
    }
    const data = await res.json();
    const messageId = String(data?.messages?.[0]?.id || '');
    return { ok: true, messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function sendViaGreenApi(
  creds: GreenApiCreds,
  chatId: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${GREEN_BASE}/waInstance${creds.idInstance}/sendMessage/${creds.apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    const data = await res.json();
    return { ok: true, messageId: data.idMessage };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function sendViaOmnichat(
  creds: OmnichatCreds,
  chatId: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const phone = phoneFromChatId(chatId) || chatId;
    const url = creds.baseUrl.replace(/\/$/, '') + '/api/messages/send';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({
        channel: creds.channel || 'whatsapp',
        to: phone,
        text: message,
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, messageId: String(data.message_id || data.id || '') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ───────────────── Проверка соединения ─────────────────

export async function checkConnection(cfg: WhatsAppConfig): Promise<{ ok: boolean; state?: string; error?: string }> {
  if (cfg.provider === 'meta-cloud') {
    const c = cfg.metaCloud!;
    if (!c.phoneNumberId || !c.accessToken) return { ok: false, error: 'Не заполнены Phone Number ID и Access Token' };
    try {
      const res = await fetch(`${META_GRAPH_BASE}/${c.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`, {
        headers: { 'Authorization': `Bearer ${c.accessToken}` },
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, error: `Meta HTTP ${res.status}: ${t.slice(0, 200)}` };
      }
      const data = await res.json();
      return {
        ok: true,
        state: `${data.verified_name || 'номер'} · ${data.display_phone_number || ''} · качество: ${data.quality_rating || 'n/a'}`,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Сетевая ошибка' };
    }
  }

  if (cfg.provider === 'green-api') {
    const c = cfg.greenApi!;
    if (!c.idInstance || !c.apiToken) return { ok: false, error: 'Не заполнены ID Instance и API Token' };
    try {
      const res = await fetch(`${GREEN_BASE}/waInstance${c.idInstance}/getStateInstance/${c.apiToken}`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, state: String(data.stateInstance || 'unknown') };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'error' };
    }
  }

  if (cfg.provider === 'omnichat') {
    const c = cfg.omnichat!;
    if (!c.baseUrl || !c.apiKey) return { ok: false, error: 'Не заполнены URL и API Key Omnichat' };
    try {
      const url = c.baseUrl.replace(/\/$/, '') + '/api/health';
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${c.apiKey}` } });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json().catch(() => ({ status: 'ok' }));
      return { ok: true, state: String(data.status || 'connected') };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Omnichat не отвечает' };
    }
  }

  return { ok: false, error: `Unknown provider: ${cfg.provider}` };
}

// ───────────────── Утилиты ─────────────────

export function phoneFromChatId(chatId: string): string {
  const digits = chatId.split('@')[0] || '';
  return digits ? `+${digits}` : '';
}

export function chatIdFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}

// Обратная совместимость
export async function getGreenApiConfigForCompany(companyId: number) {
  const cfg = await getWhatsAppConfigForCompany(companyId);
  return {
    idInstance: cfg.greenApi?.idInstance || '',
    apiToken: cfg.greenApi?.apiToken || '',
    webhookToken: cfg.webhookToken || '',
  };
}
export async function checkInstanceState(cfg: { idInstance: string; apiToken: string }) {
  try {
    const res = await fetch(`${GREEN_BASE}/waInstance${cfg.idInstance}/getStateInstance/${cfg.apiToken}`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, state: String(data.stateInstance || 'unknown') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}
