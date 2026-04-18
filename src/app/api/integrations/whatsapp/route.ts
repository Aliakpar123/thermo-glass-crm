import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';
import { getGreenApiConfigForCompany } from '@/lib/whatsapp';

// Проверка, что юзер — админ в активной компании
async function requireCompanyAdmin(companyId: number, userId: number): Promise<boolean> {
  const sql = await getDb();
  const rows = await sql`
    SELECT role FROM user_companies
    WHERE user_id = ${userId} AND company_id = ${companyId}
    LIMIT 1
  `;
  const role = rows[0]?.role as string | undefined;
  return role === 'admin';
}

// GET /api/integrations/whatsapp — текущие настройки (токен маскируется)
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const isAdmin = await requireCompanyAdmin(companyId, userId);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const cfg = await getGreenApiConfigForCompany(companyId);
  return NextResponse.json({
    idInstance: cfg.idInstance,
    // Маскируем токен при выдаче, чтобы не показывать в UI
    apiTokenMasked: cfg.apiToken ? `${cfg.apiToken.slice(0, 6)}…${cfg.apiToken.slice(-4)}` : '',
    hasApiToken: Boolean(cfg.apiToken),
    webhookToken: cfg.webhookToken,
    configured: Boolean(cfg.idInstance && cfg.apiToken),
  });
}

// PUT /api/integrations/whatsapp — сохранить настройки
// body: { idInstance, apiToken?, webhookToken? }
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const isAdmin = await requireCompanyAdmin(companyId, userId);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const idInstance = String(body.idInstance || '').trim();
  const apiToken = String(body.apiToken || '').trim();
  const webhookToken = String(body.webhookToken || '').trim();

  if (!idInstance) return NextResponse.json({ error: 'idInstance required' }, { status: 400 });

  const sql = await getDb();

  // Подтягиваем существующий конфиг, чтобы не затирать токен пустой строкой
  const existing = await sql`
    SELECT config_json FROM company_integrations
    WHERE company_id = ${companyId} AND integration_type = 'whatsapp'
    LIMIT 1
  `;

  let existingCfg: Record<string, string> = {};
  if (existing.length > 0) {
    try { existingCfg = JSON.parse(String(existing[0].config_json || '{}')); } catch { /* ignore */ }
  }

  const newCfg = {
    idInstance,
    apiToken: apiToken || existingCfg.apiToken || '',
    webhookToken: webhookToken || existingCfg.webhookToken || '',
  };
  const configJson = JSON.stringify(newCfg);

  if (existing.length > 0) {
    await sql`
      UPDATE company_integrations
      SET config_json = ${configJson}, enabled = true, updated_at = NOW()
      WHERE company_id = ${companyId} AND integration_type = 'whatsapp'
    `;
  } else {
    await sql`
      INSERT INTO company_integrations (company_id, integration_type, config_json, enabled)
      VALUES (${companyId}, 'whatsapp', ${configJson}, true)
    `;
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/integrations/whatsapp — отключить интеграцию
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const isAdmin = await requireCompanyAdmin(companyId, userId);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const sql = await getDb();
  await sql`
    DELETE FROM company_integrations
    WHERE company_id = ${companyId} AND integration_type = 'whatsapp'
  `;
  return NextResponse.json({ ok: true });
}
