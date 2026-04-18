// Хелперы для работы с WhatsApp через Green API.
// Конфиг хранится в БД (таблица company_integrations) — на каждую компанию свой.
// Если в БД нет — fallback на env переменные.

import getDb from '@/lib/db';

const GREEN_BASE = 'https://api.green-api.com';

export interface GreenApiConfig {
  idInstance: string;
  apiToken: string;
  webhookToken: string;
}

/** Получить конфиг Green API для активной компании (DB → ENV fallback). */
export async function getGreenApiConfigForCompany(companyId: number): Promise<GreenApiConfig> {
  const sql = await getDb();
  try {
    const rows = await sql`
      SELECT config_json FROM company_integrations
      WHERE company_id = ${companyId} AND integration_type = 'whatsapp' AND enabled = true
      LIMIT 1
    `;
    if (rows.length > 0) {
      const cfg = JSON.parse(String(rows[0].config_json || '{}'));
      return {
        idInstance: String(cfg.idInstance || ''),
        apiToken: String(cfg.apiToken || ''),
        webhookToken: String(cfg.webhookToken || ''),
      };
    }
  } catch {
    /* fallthrough to env */
  }
  return {
    idInstance: process.env.GREEN_API_ID_INSTANCE || '',
    apiToken: process.env.GREEN_API_TOKEN || '',
    webhookToken: process.env.GREEN_API_WEBHOOK_TOKEN || '',
  };
}

/** Для webhook'а: найти компанию у которой этот webhook_token + валидный. */
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
  // fallback на env: если token совпадает с ENV — компания определяется из ?company=
  return null;
}

export function isConfigured(cfg: GreenApiConfig | null | undefined): boolean {
  return Boolean(cfg?.idInstance && cfg?.apiToken);
}

/** Отправить текстовое сообщение через Green API. */
export async function sendWhatsAppText(
  cfg: GreenApiConfig,
  chatId: string, // формат "77011234567@c.us"
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!cfg.idInstance || !cfg.apiToken) {
    return { ok: false, error: 'Green API не настроен' };
  }
  try {
    const res = await fetch(`${GREEN_BASE}/waInstance${cfg.idInstance}/sendMessage/${cfg.apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }
    const data = await res.json();
    return { ok: true, messageId: data.idMessage };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

/** Проверить состояние инстанса: authorized / notAuthorized / blocked. */
export async function checkInstanceState(cfg: GreenApiConfig): Promise<{ ok: boolean; state?: string; error?: string }> {
  if (!cfg.idInstance || !cfg.apiToken) return { ok: false, error: 'Не заполнены ID Instance и API Token' };
  try {
    const res = await fetch(`${GREEN_BASE}/waInstance${cfg.idInstance}/getStateInstance/${cfg.apiToken}`);
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, state: String(data.stateInstance || 'unknown') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сетевая ошибка' };
  }
}

export function phoneFromChatId(chatId: string): string {
  const digits = chatId.split('@')[0] || '';
  return digits ? `+${digits}` : '';
}

export function chatIdFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}
