import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveCompanyId } from '@/lib/company';
import { checkInstanceState, getGreenApiConfigForCompany } from '@/lib/whatsapp';

// GET /api/integrations/whatsapp/test → проверить подключение к Green API
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getActiveCompanyId();
  if (!companyId) return NextResponse.json({ error: 'No active company' }, { status: 403 });

  const cfg = await getGreenApiConfigForCompany(companyId);
  const res = await checkInstanceState(cfg);
  return NextResponse.json(res);
}
