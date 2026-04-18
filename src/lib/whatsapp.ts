// Хелперы для работы с WhatsApp через Green API.
// Green API: https://green-api.com/ — бесплатно до 3000 сообщений/мес.
// В Vercel/ENV нужно настроить:
//   GREEN_API_ID_INSTANCE=xxxxxx
//   GREEN_API_TOKEN=xxxxxxxxxxxxxx
//   GREEN_API_WEBHOOK_TOKEN=любой_свой_секрет_для_защиты_webhook_URL

const GREEN_BASE = 'https://api.green-api.com';

export function getGreenApiConfig() {
  return {
    idInstance: process.env.GREEN_API_ID_INSTANCE || '',
    apiToken: process.env.GREEN_API_TOKEN || '',
    webhookToken: process.env.GREEN_API_WEBHOOK_TOKEN || '',
  };
}

export function isGreenApiConfigured(): boolean {
  const c = getGreenApiConfig();
  return Boolean(c.idInstance && c.apiToken);
}

/** Отправить текстовое сообщение через Green API. */
export async function sendWhatsAppText(
  chatId: string, // формат "77011234567@c.us"
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { idInstance, apiToken } = getGreenApiConfig();
  if (!idInstance || !apiToken) {
    return { ok: false, error: 'Green API не настроен (проверьте GREEN_API_ID_INSTANCE и GREEN_API_TOKEN)' };
  }

  try {
    const res = await fetch(`${GREEN_BASE}/waInstance${idInstance}/sendMessage/${apiToken}`, {
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

/** Нормализовать телефон из WhatsApp chat_id вида "77011234567@c.us" → "+77011234567" */
export function phoneFromChatId(chatId: string): string {
  const digits = chatId.split('@')[0] || '';
  return digits ? `+${digits}` : '';
}

/** И обратно — из телефона в chat_id. */
export function chatIdFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@c.us`;
}
