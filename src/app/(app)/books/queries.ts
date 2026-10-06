import "server-only";
import { prisma } from "@/lib/prisma";
import type { StaffUser } from "@/lib/session";
import type { SellableBook } from "../finance/income/sell-books-dialog";

/**
 * What can be sold now at the branches this user takes money at: books on
 * the list and on sale at the branch, with copies on its shelf.
 */
export async function sellableBooks(user: StaffUser): Promise<SellableBook[]> {
  const rows = await prisma.branchBook.findMany({
    where: {
      active: true,
      stock: { gt: 0 },
      book: { active: true },
      branch: { active: true },
      ...(user.role === "admin" ? {} : { branchId: user.branchId ?? "" }),
    },
    orderBy: { book: { title: "asc" } },
    select: {
      id: true,
      branchId: true,
      price: true,
      stock: true,
      book: { select: { title: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    branchId: row.branchId,
    title: row.book.title,
    price: row.price.toString(),
    stock: row.stock,
  }));
}

/** How far back a shelf's history goes on the book's page. */
export const HISTORY_SIZE = 20;

/**
 * The latest things that happened to one branch's copies of a book, newest
 * first: deliveries and counts fixed by hand, and the sales that took copies
 * off. Each is placed by when it was recorded, because that's when the count
 * moved.
 */
export async function shelfHistory(branchBookId: string) {
  const [changes, sales] = await Promise.all([
    prisma.stockChange.findMany({
      where: { branchBookId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_SIZE,
      include: { recordedBy: { select: { name: true } } },
    }),
    prisma.bookSaleLine.findMany({
      where: { branchBookId },
      orderBy: { payment: { createdAt: "desc" } },
      take: HISTORY_SIZE,
      include: {
        payment: {
          select: {
            number: true,
            createdAt: true,
            student: { select: { id: true, number: true, fullName: true } },
            recordedBy: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return [
    ...changes.map((change) => ({
      key: change.id,
      at: change.createdAt,
      kind: change.kind,
      quantity: change.quantity,
      stockAfter: change.stockAfter as number | null,
      note: change.note,
      receipt: null as number | null,
      student: null as { id: string; number: number; fullName: string } | null,
      recordedBy: change.recordedBy.name,
    })),
    ...sales.map((line) => ({
      key: `sale-${line.paymentId}`,
      at: line.payment.createdAt,
      kind: "SOLD" as const,
      quantity: -line.quantity,
      stockAfter: null,
      note: null,
      receipt: line.payment.number,
      student: line.payment.student,
      recordedBy: line.payment.recordedBy.name,
    })),
  ]
    .toSorted((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, HISTORY_SIZE);
}
