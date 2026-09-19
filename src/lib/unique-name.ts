/**
 * A where-clause that finds another record with the same name, ignoring
 * case. The database's unique indexes compare names exactly, but "Main
 * Branch" and "main branch" are the same branch to anyone reading a list.
 */
export function sameNameAs(name: string, exceptId?: string) {
  return {
    name: { equals: name, mode: "insensitive" as const },
    ...(exceptId ? { id: { not: exceptId } } : {}),
  };
}
