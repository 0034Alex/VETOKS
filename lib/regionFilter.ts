// Показывать запись, если она для всех регионов страны или регион зрителя отмечен в её списке.
export function visibleInRegion<T extends { all_regions?: boolean | null }>(
  rows: T[],
  regionId: string | null,
  joinKey: string
): T[] {
  return rows.filter((r: any) => {
    if (r.all_regions !== false) return true;
    if (!regionId) return false;
    return (r[joinKey] ?? []).some((x: any) => x.region_id === regionId);
  });
}
