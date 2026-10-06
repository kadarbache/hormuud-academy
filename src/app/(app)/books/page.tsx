import type { Metadata } from "next";
import Link from "next/link";
import { BookCopy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { collegeToday } from "@/lib/dates";
import { currentRate } from "@/lib/exchange-rate";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStaff, type StaffUser } from "@/lib/session";
import { sellBooks } from "../finance/income/actions";
import { recordableBranches } from "../finance/income/queries";
import { SellBooksDialog } from "../finance/income/sell-books-dialog";
import { addCopies, createBook, fixCount } from "./actions";
import { AddCopiesDialog, BookDialog, FixCountDialog } from "./book-dialogs";
import { copies } from "./labels";
import { sellableBooks } from "./queries";
import { Stock } from "./stock";

export const metadata: Metadata = { title: "Books" };

/** Every book on the list, with what each branch charges and has. */
async function AdminBooks() {
  const books = await prisma.book.findMany({
    orderBy: { title: "asc" },
    include: {
      branchBooks: {
        orderBy: { branch: { name: "asc" } },
        include: { branch: { select: { name: true } } },
      },
    },
  });

  if (books.length === 0) {
    return <EmptyRow message="No books yet. Add one, then the branches that sell it." />;
  }
  return (
    <DataTable
      columns={[
        { label: "Book", className: "font-medium" },
        { label: "Default price", className: "text-right tabular-nums" },
        { label: "Branches", className: "max-w-96 whitespace-normal" },
        { label: "Copies", className: "text-right tabular-nums" },
        { label: "Status" },
      ]}
      rows={books.map((book) => ({
        key: book.id,
        title: book.title,
        description: `Default price ${formatMoney(book.price.toString())}`,
        cells: {
          Book: (
            <Link href={`/books/${book.id}`} className="hover:underline">
              {book.title}
            </Link>
          ),
          "Default price": formatMoney(book.price.toString()),
          Branches:
            book.branchBooks.length === 0 ? (
              <span className="text-muted-foreground">Not sold anywhere yet</span>
            ) : (
              <ul className="space-y-0.5">
                {book.branchBooks.map((bb) => (
                  <li key={bb.id} className={bb.active ? undefined : "text-muted-foreground"}>
                    {bb.branch.name}: {formatMoney(bb.price.toString())}, {copies(bb.stock)}
                    {!bb.active && " (stopped)"}
                  </li>
                ))}
              </ul>
            ),
          Copies: book.branchBooks.reduce((sum, bb) => sum + bb.stock, 0),
          Status: <ActiveBadge active={book.active} />,
        },
      }))}
    />
  );
}

/** The books one branch sells, with its shelf and the buttons to keep it right. */
async function BranchBooks({ user }: { user: StaffUser }) {
  const shelves = await prisma.branchBook.findMany({
    where: { branchId: user.branchId ?? "" },
    orderBy: { book: { title: "asc" } },
    include: {
      book: { select: { title: true, active: true } },
      branch: { select: { name: true } },
    },
  });

  if (shelves.length === 0) {
    return <EmptyRow message="Your branch doesn't sell any books yet. The admin adds them." />;
  }
  return (
    <DataTable
      columns={[
        { label: "Book", className: "font-medium" },
        { label: "Price", className: "text-right tabular-nums" },
        { label: "On the shelf", className: "text-right" },
        { label: "Status" },
        { label: "Actions", actions: true, className: "text-right" },
      ]}
      rows={shelves.map((shelf) => ({
        key: shelf.id,
        title: shelf.book.title,
        description: `${formatMoney(shelf.price.toString())} a copy`,
        cells: {
          Book: (
            <Link href={`/books/${shelf.bookId}`} className="hover:underline">
              {shelf.book.title}
            </Link>
          ),
          Price: formatMoney(shelf.price.toString()),
          "On the shelf": <Stock stock={shelf.stock} />,
          Status: <ActiveBadge active={shelf.active && shelf.book.active} />,
          Actions: (
            <div className="flex justify-end gap-1">
              <AddCopiesDialog
                action={addCopies.bind(null, shelf.id)}
                title={shelf.book.title}
                branchName={shelf.branch.name}
                stock={shelf.stock}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus />
                    Add copies
                  </Button>
                }
              />
              <FixCountDialog
                action={fixCount.bind(null, shelf.id)}
                title={shelf.book.title}
                branchName={shelf.branch.name}
                stock={shelf.stock}
                trigger={
                  <Button variant="ghost" size="sm">
                    Fix count
                  </Button>
                }
              />
            </div>
          ),
        },
      }))}
    />
  );
}

export default async function BooksPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  const [branches, onShelf, rate] = await Promise.all([
    recordableBranches(user),
    sellableBooks(user),
    currentRate(),
  ]);

  return (
    <>
      <PageHeader
        title="Books"
        description={
          isAdmin
            ? "The books the college sells. Each branch sets its own price and keeps its own copies. Open a book to add it to a branch, change its price there or see what happened to its copies."
            : "The books your branch sells and the copies on the shelf. Add copies as they arrive, and fix the count if the shelf says otherwise. Only the admin adds books and sets prices."
        }
      >
        <SellBooksDialog
          action={sellBooks}
          branches={branches}
          books={onShelf}
          rate={rate}
          today={collegeToday()}
          trigger={
            <Button variant="outline" disabled={onShelf.length === 0}>
              <BookCopy />
              Sell books
            </Button>
          }
        />
        {isAdmin && (
          <BookDialog
            action={createBook}
            trigger={
              <Button>
                <Plus />
                Add book
              </Button>
            }
          />
        )}
      </PageHeader>

      {isAdmin ? <AdminBooks /> : <BranchBooks user={user} />}
    </>
  );
}
