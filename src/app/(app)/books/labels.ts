// Words for books, shared by the screens and the actions. Safe to import from
// client components: no database, no session.

import type { StockChangeKind } from "@/generated/prisma/client";

/** 1 -> "1 copy", 3 -> "3 copies" */
export function copies(count: number) {
  return count === 1 ? "1 copy" : `${count} copies`;
}

/** 1 -> "1 book", 3 -> "3 books" */
export function books(count: number) {
  return count === 1 ? "1 book" : `${count} books`;
}

export const stockChangeLabels: Record<StockChangeKind, string> = {
  RECEIVED: "Delivery",
  CORRECTED: "Count fixed",
};
