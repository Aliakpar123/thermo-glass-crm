// Список slug'ов компаний, в которых настроены CRM-модули.
// Новые компании по умолчанию попадают на /empty до настройки.
export const COMPANIES_WITH_CRM = ['thermo'];

export function isCompanyConfigured(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return COMPANIES_WITH_CRM.includes(slug);
}

export function defaultLandingForCompany(slug: string | null | undefined): string {
  return isCompanyConfigured(slug) ? '/deals' : '/empty';
}
