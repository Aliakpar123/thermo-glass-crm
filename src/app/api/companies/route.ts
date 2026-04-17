import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserCompanies } from '@/lib/company';

// GET /api/companies → список компаний текущего пользователя
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = Number((session?.user as { id?: string })?.id);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companies = await getUserCompanies(userId);
    return NextResponse.json(companies);
  } catch (error) {
    console.error('Error listing companies:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
