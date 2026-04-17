import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDb from '@/lib/db';

export const ACTIVE_COMPANY_COOKIE = 'active_company_id';

export interface UserCompany {
  id: number;
  name: string;
  slug: string;
  logo_emoji: string;
  color: string;
  description: string;
  role: string;
  is_owner: boolean;
}

/** Получить список компаний текущего пользователя */
export async function getUserCompanies(userId: number): Promise<UserCompany[]> {
  const sql = await getDb();
  const rows = await sql`
    SELECT c.id, c.name, c.slug, c.logo_emoji, c.color, c.description,
      uc.role, uc.is_owner
    FROM user_companies uc
    JOIN companies c ON c.id = uc.company_id
    WHERE uc.user_id = ${userId}
    ORDER BY c.name ASC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    slug: String(r.slug),
    logo_emoji: String(r.logo_emoji || '🏢'),
    color: String(r.color || '#22c55e'),
    description: String(r.description || ''),
    role: String(r.role),
    is_owner: Boolean(r.is_owner),
  }));
}

/** Получить ID активной компании с учётом того, что у юзера есть к ней доступ. */
export async function getActiveCompanyId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as { id?: string })?.id);
  if (!userId) return null;

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const companies = await getUserCompanies(userId);
  if (companies.length === 0) return null;

  if (cookieVal) {
    const id = Number(cookieVal);
    if (companies.some((c) => c.id === id)) return id;
  }
  // fallback: первая доступная
  return companies[0].id;
}

/** Проверка, что юзер имеет доступ к компании */
export async function userHasCompanyAccess(userId: number, companyId: number): Promise<boolean> {
  const sql = await getDb();
  const rows = await sql`
    SELECT id FROM user_companies
    WHERE user_id = ${userId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows.length > 0;
}
