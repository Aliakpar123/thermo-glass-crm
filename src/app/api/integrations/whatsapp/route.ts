import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';
import { getActiveCompanyId } from '@/lib/company';
import { getWhatsAppConfigForCompany } from '@/lib/whatsapp';

async function requireCompanyAdmin(companyId: number, userId: number): Promise<boolean> {
  const sql = await getDb();
  const rows = await sql`
    SELECT role FROM user_companies
    WHERE user_id = ${userId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows[0]?.role === 'admin';
}

function maskToken(t: string): string {
  if (!t) return '';
  if (t.length < 12) return '***';
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const isAdmin = await requireCompanyAdmin(companyId, userId);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const cfg = await getWhatsAppConfigForCompany(companyId);
  return NextResponse.json({
    provider: cfg.provider,
    webhookToken: cfg.webhookToken,
    greenApi: {
      idInstance: cfg.greenApi?.idInstance || '',
      apiTokenMasked: maskToken(cfg.greenApi?.apiToken || ''),
      hasApiToken: Boolean(cfg.greenApi?.apiToken),
    },
    omnichat: {
      baseUrl: cfg.omnichat?.baseUrl || '',
      apiKeyMasked: maskToken(cfg.omnichat?.apiKey || ''),
      hasApiKey: Boolean(cfg.omnichat?.apiKey),
      channel: cfg.omnichat?.channel || 'whatsapp',
    },
    configured:
      (cfg.provider === 'green-api' && Boolean(cfg.greenApi?.idInstance && cfg.greenApi?.apiToken)) ||
      (cfg.provider === 'omnichat' && Boolean(cfg.omnichat?.baseUrl && cfg.omnichat?.apiKey)),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const isAdmin = await requireCompanyAdmin(companyId, userId);
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const provider = String(body.provider || 'green-api') as 'green-api' | 'omnichat';
  const webhookToken = String(body.webhookToken || '').trim();

  const sql = await getDb();
  const existing = await sql`
    SELECT config_json FROM company_integrations
    WHERE company_id = ${companyId} AND integration_type = 'whatsapp'
    LIMIT 1
  `;
  let existingCfg: Record<string, unknown> = {};
  if (existing.length > 0) {
    try { existingCfg = JSON.parse(String(existing[0].config_json || '{}')); } catch { /* ignore */ }
  }

  const existingGreen = (existingCfg.greenApi as Record<string, string> | undefined) || {};
  const existingOmni = (existingCfg.omnichat as Record<string, string> | undefined) || {};

  // Новый конфиг: не затираем токены, если поле пустое.
  const newCfg: Record<string, unknown> = {
    provider,
    webhookToken: webhookToken || String(existingCfg.webhookToken || ''),
    greenApi: {
      idInstance: String(body.greenApi?.idInstance || existingGreen.idInstance || '').trim(),
      apiToken: String(body.greenApi?.apiToken || existingGreen.apiToken || '').trim(),
    },
    omnichat: {
      baseUrl: String(body.omnichat?.baseUrl || existingOmni.baseUrl || '').trim().replace(/\/$/, ''),
      apiKey: String(body.omnichat?.apiKey || existingOmni.apiKey || '').trim(),
      channel: String(body.omnichat?.channel || existingOmni.channel || 'whatsapp'),
    },
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
