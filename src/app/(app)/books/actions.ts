"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { canActAtBranch } from "@/lib/access";
import {
  failure,
  invalid,
  isForeignKeyViolation,
  isUniqueViolation,
  success,
  type ActionResult,
} from "@/lib/action-result";
import { isPositiveMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/session";
import { formObject, money, optionalText, requiredId, requiredText } from "@/lib/validation";
import { copies } from "./labels";

// The book list and each branch's shelf. The admin keeps the list and sets
// every price. Staff at a branch record the copies that arrive there and fix
// its count when the shelf says otherwise. Selling is a payment, so it's in
// finance/income/actions.ts with the rest of them.

const price = (message: string) =>
  money(message).refine(isPositiveMoney, "A book has to cost something. Enter a price above zero.");

const bookSchema = z.object({
  title: requiredText("Enter the book's title.", 120),
  price: price("Enter the default price."),
});

const titleTaken = failure("Check the highlighted fields.", {
  title: ["There's already a book with this title."],
});

/** Another book with the same title, ignoring case, like sameNameAs. */
function sameTitleAs(title: string, exceptId?: string) {
  return {
    title: { equals: title, mode: "insensitive" as const },
    ...(exceptId ? { id: { not: exceptId } } : {}),
  };
}

// --- The book list -----------------------------------------------------------

export async function createBook(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = bookSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.book.findFirst({ where: sameTitleAs(parsed.data.title) })) return titleTaken;

  try {
    const book = await prisma.book.create({ data: parsed.data });
    refresh();
    return success(`${book.title} added. Now add it to the branches that sell it.`, {
      id: book.id,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return titleTaken;
    throw error;
  }
}

/**
 * The price here is only the default for branches added from now on.
 * Branches that sell the book already keep their own.
 */
export async function updateBook(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bookSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (await prisma.book.findFirst({ where: sameTitleAs(parsed.data.title, id) })) return titleTaken;

  try {
    await prisma.book.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return titleTaken;
    throw error;
  }

  refresh();
  return success("Book saved.");
}

/** A deactivated book can't be sold at any branch. Its copies and sales stay. */
export async function setBookActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const book = await prisma.book.update({ where: { id }, data: { active } });
  refresh();
  return success(
    active ? `${book.title} is on sale again.` : `${book.title} deactivated. No branch can sell it now.`,
  );
}

/** Only for a book no branch sells yet. After that, deactivate it. */
export async function deleteBook(id: string): Promise<ActionResult> {
  await requireAdmin();
  const book = await prisma.book.findUnique({
    where: { id },
    include: { _count: { select: { branchBooks: true } } },
  });
  if (!book) return failure("That book no longer exists.");

  const inUse = failure(`A branch sells ${book.title}. Deactivate it instead.`);
  if (book._count.branchBooks > 0) return inUse;

  try {
    await prisma.book.delete({ where: { id } });
  } catch (error) {
    // Added to a branch since the check above.
    if (isForeignKeyViolation(error)) return inUse;
    throw error;
  }

  refresh();
  return success(`${book.title} deleted.`);
}

// --- The book at one branch ----------------------------------------------------

const branchPriceSchema = z.object({ price: price("Enter the price at this branch.") });

export async function addBranchBook(bookId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = branchPriceSchema
    .extend({ branchId: requiredId("Pick the branch.") })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
  if (!branch?.active) return failure("Pick an active branch.");

  try {
    await prisma.branchBook.create({ data: { bookId, ...parsed.data } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Check the highlighted fields.", {
        branchId: [`${branch.name} already sells this book.`],
      });
    }
    throw error;
  }

  refresh();
  return success(`${branch.name} sells it now. Add the copies it has so it can be sold.`);
}

/** A new price applies to sales from now on. Every sale keeps the price it was sold at. */
export async function updateBranchBook(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = branchPriceSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const branchBook = await prisma.branchBook.findUnique({ where: { id } });
  if (!branchBook) return failure("That branch no longer sells this book.");

  await prisma.branchBook.update({ where: { id }, data: parsed.data });
  refresh();
  return success("Price saved.");
}

export async function setBranchBookActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const branchBook = await prisma.branchBook.update({
    where: { id },
    data: { active },
    include: { branch: { select: { name: true } } },
  });
  refresh();
  return success(
    active
      ? `${branchBook.branch.name} sells it again.`
      : `${branchBook.branch.name} stopped selling it. Its copies stay on the count.`,
  );
}

/**
 * Only while nothing has happened to the book at this branch: no copies
 * recorded, none sold. After that its history stays, so deactivate it.
 */
export async function deleteBranchBook(id: string): Promise<ActionResult> {
  await requireAdmin();
  const branchBook = await prisma.branchBook.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true } },
      _count: { select: { saleLines: true, stockChanges: true } },
    },
  });
  if (!branchBook) return failure("That branch no longer sells this book.");

  const inUse = failure("Copies of it have been recorded or sold at this branch. Deactivate it instead.");
  if (branchBook._count.saleLines > 0 || branchBook._count.stockChanges > 0) return inUse;

  try {
    await prisma.branchBook.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyViolation(error)) return inUse;
    throw error;
  }

  refresh();
  return success(`Removed from ${branchBook.branch.name}.`);
}

// --- The shelf -----------------------------------------------------------------

/** The most copies one delivery or count can be. Far more than any shelf holds. */
const MAX_COPIES = 10000;

const copiesField = (message: string, min: number) =>
  z.coerce
    .number({ error: message })
    .int("Use a whole number of copies.")
    .min(min, min === 0 ? "The count can't be below zero." : "Add at least 1 copy.")
    .max(MAX_COPIES, `At most ${MAX_COPIES} copies.`);

/** A branch book the user may change the count of, with what the messages need. */
async function findShelf(id: string) {
  const user = await requireStaff();
  const branchBook = await prisma.branchBook.findUnique({
    where: { id },
    include: { book: { select: { title: true } }, branch: { select: { name: true } } },
  });
  if (!branchBook) return { error: failure("That branch no longer sells this book.") };
  if (!canActAtBranch(user, branchBook.branchId)) {
    return { error: failure("Only staff at the book's branch can change its count.") };
  }
  return { user, branchBook };
}

/** Thrown inside a transaction to undo it when the count moved under us. */
class CountMoved extends Error {}

/** Copies that arrived at the branch go on its shelf. */
export async function addCopies(id: string, formData: FormData): Promise<ActionResult> {
  const shelf = await findShelf(id);
  if (shelf.error) return shelf.error;
  const { user, branchBook } = shelf;

  const parsed = z
    .object({
      copies: copiesField("Enter how many copies arrived.", 1),
      note: optionalText(200),
    })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const stock = await prisma.$transaction(async (tx) => {
    const updated = await tx.branchBook.update({
      where: { id },
      data: { stock: { increment: parsed.data.copies } },
    });
    await tx.stockChange.create({
      data: {
        branchBookId: id,
        kind: "RECEIVED",
        quantity: parsed.data.copies,
        stockAfter: updated.stock,
        note: parsed.data.note,
        recordedById: user.id,
      },
    });
    return updated.stock;
  });

  refresh();
  return success(
    `${copies(parsed.data.copies)} of ${branchBook.book.title} added. ${branchBook.branch.name} has ${stock} now.`,
  );
}

/**
 * Sets the count to what's really on the shelf, with the reason, so a copy
 * that went missing or was damaged doesn't vanish without a word. If a sale
 * changes the count while this is being typed, nothing is saved: the person
 * counting should look again.
 */
export async function fixCount(id: string, formData: FormData): Promise<ActionResult> {
  const shelf = await findShelf(id);
  if (shelf.error) return shelf.error;
  const { user, branchBook } = shelf;

  const parsed = z
    .object({
      count: copiesField("Enter how many copies are on the shelf.", 0),
      note: requiredText("Say why the count changed, like two damaged copies.", 200),
    })
    .safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { count, note } = parsed.data;
  if (count === branchBook.stock) {
    return failure("Check the highlighted fields.", {
      count: [`That's the count already: ${copies(count)}.`],
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.branchBook.updateMany({
        where: { id, stock: branchBook.stock },
        data: { stock: count },
      });
      if (changed.count === 0) throw new CountMoved();
      await tx.stockChange.create({
        data: {
          branchBookId: id,
          kind: "CORRECTED",
          quantity: count - branchBook.stock,
          stockAfter: count,
          note,
          recordedById: user.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof CountMoved) {
      return failure(
        "The count changed while you were typing, maybe from a sale. Close this, check the new count and try again.",
      );
    }
    throw error;
  }

  refresh();
  return success(`${branchBook.book.title} at ${branchBook.branch.name} is set to ${copies(count)}.`);
}
