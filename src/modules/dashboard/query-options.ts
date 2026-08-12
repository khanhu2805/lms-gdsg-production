export const DASHBOARD_PAGE_SIZES = [20, 50, 100] as const;

export function parseDashboardPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseDashboardPageSize(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "20", 10);
  return DASHBOARD_PAGE_SIZES.includes(
    parsed as (typeof DASHBOARD_PAGE_SIZES)[number],
  )
    ? parsed
    : 20;
}
