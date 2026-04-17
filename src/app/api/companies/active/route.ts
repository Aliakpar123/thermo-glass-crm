import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ACTIVE_COMPANY_COOKIE, getActiveCompanyId, userHasCompanyAccess } from '@/lib/company';

// GET /api/companies/active → id активной компании
export async function GET() {
  try {
    const id = await getActiveCompanyId();
    return NextResponse.json({ company_id: id });
  } catch (error) {
    console.error('Error getting active company:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/companies/active → сменить активную компанию (body: {company_id})
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = Number((session?.user as { id?: string })?.id);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const companyId = Number(body.company_id);
    if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 });

    const hasAccess = await userHasCompanyAccess(userId, companyId);
    if (!hasAccess) return NextResponse.json({ error: 'No access' }, { status: 403 });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_COMPANY_COOKIE, String(companyId), {
      httpOnly: false, // клиент тоже может читать для отображения
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 дней
      sameSite: 'lax',
    });

    return NextResponse.json({ company_id: companyId });
  } catch (error) {
    console.error('Error setting active company:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
