import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ActiveBadge, EmptyRow } from "@/components/status-badge";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatStudentNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import {
  addBranchBook,
  addCopies,
  deleteBook,
  deleteBranchBook,
  fixCount,
  setBookActive,
  setBranchBookActive,
  updateBook,
  updateBranchBook,
} from "../actions";
import { AddCopiesDialog, BookDialog, BranchBookDialog, FixCountDialog } from "../book-dialogs";
import { copies, stockChangeLabels } from "../labels";
import { HISTORY_SIZE, shelfHistory } from "../queries";
import { Stock } from "../stock";

export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const { id } = await params;
  const book = await prisma.book.findUnique({ where: { id }, select: { title: true } });
  return { title: book?.title ?? "Book" };
}

/** +20, or −2 with a real minus sign. */
function signed(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `−${Math.abs(quantity)}`;
}

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      // Branch staff see their own branch's shelf, and only that one is theirs
      // to change, so every shelf shown here can be changed by whoever sees it.
      branchBooks: {
        where: isAdmin ? {} : { branchId: user.branchId ?? "" },
        orderBy: { branch: { name: "asc" } },
        include: {
          branch: { select: { name: true } },
          _count: { select: { saleLines: true, stockChanges: true } },
        },
      },
      _count: { select: { branchBooks: true } },
    },
  });
  if (!book) notFound();
  // Staff see a book once their branch sells it.
  if (!isAdmin && book.branchBooks.length === 0) notFound();

  const [branches, histories] = await Promise.all([
    isAdmin ? prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
    Promise.all(book.branchBooks.map((bb) => shelfHistory(bb.id))),
  ]);
  const takenBranchIds = new Set(book.branchBooks.map((bb) => bb.branchId));
  const openBranches = branches
    .filter((branch) => !takenBranchIds.has(branch.id))
    .map((branch) => ({ value: branch.id, label: branch.name }));
  const defaultPrice = book.price.toString();

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/books">
          <ChevronLeft />
          Books
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {book.title}
            <ActiveBadge active={book.active} />
          </span>
        }
        description={
          isAdmin
            ? `Default price for a new branch: ${formatMoney(defaultPrice)}`
            : book.active
              ? undefined
              : "The admin has taken this book off sale."
        }
      >
        {isAdmin && (
          <>
            <BookDialog
              action={updateBook.bind(null, book.id)}
              book={{ title: book.title, price: defaultPrice }}
              trigger={<Button variant="outline">Edit book</Button>}
            />
            <ActionButton variant="outline" action={setBookActive.bind(null, book.id, !book.active)}>
              {book.active ? "Deactivate" : "Activate"}
            </ActionButton>
            {book._count.branchBooks === 0 && (
              <ActionButton
                variant="destructive"
                action={deleteBook.bind(null, book.id)}
                redirectTo="/books"
                confirm={{
                  title: `Delete ${book.title}?`,
                  description: "No branch sells this book yet, so it can be deleted for good.",
                  confirmLabel: "Delete book",
                  destructive: true,
                }}
              >
                Delete
              </ActionButton>
            )}
          </>
        )}
      </PageHeader>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {isAdmin ? "Branches that sell it" : "At your branch"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Each branch sets its own price and keeps its own copies. A sale takes copies off the
              shelf; a delivery or a fixed count puts them right.
            </p>
          </div>
          {isAdmin && (
            <BranchBookDialog
              action={addBranchBook.bind(null, book.id)}
              branches={openBranches}
              price={defaultPrice}
              trigger={
                <Button disabled={openBranches.length === 0}>
                  <Plus />
                  Add to a branch
                </Button>
              }
            />
          )}
        </div>

        {book.branchBooks.length === 0 && (
          <EmptyRow message="No branch sells this book yet, so it can't be sold." />
        )}

        <Accordion
          type="multiple"
          // Every branch starts closed for the admin, who sees them all. Branch staff see
          // only their own, so there is nothing to choose between and it starts open.
          defaultValue={isAdmin ? [] : book.branchBooks.map((bb) => bb.id)}
          className="space-y-3"
        >
          {book.branchBooks.map((bb, index) => {
            const history = histories[index];
            const unused = bb._count.saleLines === 0 && bb._count.stockChanges === 0;
            return (
              <AccordionItem key={bb.id} value={bb.id}>
                <AccordionTrigger>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 font-semibold">
                      {bb.branch.name}
                      <ActiveBadge active={bb.active} />
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                      {formatMoney(bb.price.toString())} a copy · on the shelf: <Stock stock={bb.stock} />
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-3">
                    <div className="flex flex-wrap gap-1">
                      <AddCopiesDialog
                        action={addCopies.bind(null, bb.id)}
                        title={book.title}
                        branchName={bb.branch.name}
                        stock={bb.stock}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Plus />
                            Add copies
                          </Button>
                        }
                      />
                      <FixCountDialog
                        action={fixCount.bind(null, bb.id)}
                        title={book.title}
                        branchName={bb.branch.name}
                        stock={bb.stock}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Fix count
                          </Button>
                        }
                      />
                      {isAdmin && (
                        <>
                          <BranchBookDialog
                            action={updateBranchBook.bind(null, bb.id)}
                            branches={[]}
                            branchName={bb.branch.name}
                            price={bb.price.toString()}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Change price
                              </Button>
                            }
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={setBranchBookActive.bind(null, bb.id, !bb.active)}
                          >
                            {bb.active ? "Deactivate" : "Activate"}
                          </ActionButton>
                          {unused && (
                            <ActionButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              action={deleteBranchBook.bind(null, bb.id)}
                              confirm={{
                                title: `Remove ${book.title} from ${bb.branch.name}?`,
                                description:
                                  "No copies have been recorded or sold here, so it can be removed for good.",
                                confirmLabel: "Remove",
                                destructive: true,
                              }}
                            >
                              Remove
                            </ActionButton>
                          )}
                        </>
                      )}
                    </div>

                    {history.length === 0 ? (
                      <EmptyRow message="Nothing has happened to its copies here yet. Add the copies the branch has so it can be sold." />
                    ) : (
                      <>
                        <DataTable
                          columns={[
                            { label: "When", className: "whitespace-nowrap" },
                            { label: "What" },
                            { label: "Copies", className: "text-right tabular-nums" },
                            { label: "Details", className: "max-w-80 whitespace-normal" },
                            { label: "By", className: "text-muted-foreground" },
                          ]}
                          rows={history.map((event) => {
                            const what = event.kind === "SOLD" ? "Sale" : stockChangeLabels[event.kind];
                            return {
                              key: event.key,
                              title: `${what}, ${signed(event.quantity)}`,
                              description: formatDateTime(event.at),
                              cells: {
                                When: formatDateTime(event.at),
                                What: what,
                                Copies: signed(event.quantity),
                                Details:
                                  event.kind === "SOLD" ? (
                                    <>
                                      Receipt {event.receipt}
                                      {event.student && (
                                        <>
                                          {" to "}
                                          <Link
                                            href={`/students/${event.student.id}`}
                                            className="hover:underline"
                                          >
                                            {event.student.fullName}
                                          </Link>{" "}
                                          <span className="font-mono text-xs text-muted-foreground">
                                            {formatStudentNumber(event.student.number)}
                                          </span>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {event.kind === "CORRECTED" && `Counted ${copies(event.stockAfter ?? 0)}. `}
                                      {event.note}
                                    </>
                                  ),
                                By: event.recordedBy,
                              },
                            };
                          })}
                        />
                        {history.length === HISTORY_SIZE && (
                          <p className="text-xs text-muted-foreground">
                            The latest {HISTORY_SIZE}. Older sales are on the Income screen, under Books.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </>
  );
}
