/** What a page receives in `searchParams` once it's awaited. */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * One value from the query string. A key given twice ("?status=a&status=b")
 * takes the first, and a missing key reads as empty rather than undefined,
 * so filters can be compared without checking for null everywhere.
 */
export function one(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
