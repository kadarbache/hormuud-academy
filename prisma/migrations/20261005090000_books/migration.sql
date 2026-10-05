-- Books. The college sells books over the counter, and until now a sale was
-- a Books payment with a note saying what was sold. Now there's one list of
-- books for the college, each branch that sells one sets its own price and
-- keeps its own copies, and a sale lists the books on it. Old Books payments
-- stay as they are, with their notes and no lines.

-- CreateEnum
CREATE TYPE "StockChangeKind" AS ENUM ('RECEIVED', 'CORRECTED');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_books" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_sale_lines" (
    "paymentId" TEXT NOT NULL,
    "branchBookId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "book_sale_lines_pkey" PRIMARY KEY ("paymentId","branchBookId")
);

-- CreateTable
CREATE TABLE "stock_changes" (
    "id" TEXT NOT NULL,
    "branchBookId" TEXT NOT NULL,
    "kind" "StockChangeKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "books_title_key" ON "books"("title");

-- CreateIndex
CREATE INDEX "branch_books_branchId_idx" ON "branch_books"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_books_bookId_branchId_key" ON "branch_books"("bookId", "branchId");

-- CreateIndex
CREATE INDEX "book_sale_lines_branchBookId_idx" ON "book_sale_lines"("branchBookId");

-- CreateIndex
CREATE INDEX "stock_changes_branchBookId_createdAt_idx" ON "stock_changes"("branchBookId", "createdAt");

-- AddForeignKey
ALTER TABLE "branch_books" ADD CONSTRAINT "branch_books_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_books" ADD CONSTRAINT "branch_books_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_sale_lines" ADD CONSTRAINT "book_sale_lines_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_sale_lines" ADD CONSTRAINT "book_sale_lines_branchBookId_fkey" FOREIGN KEY ("branchBookId") REFERENCES "branch_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_changes" ADD CONSTRAINT "stock_changes_branchBookId_fkey" FOREIGN KEY ("branchBookId") REFERENCES "branch_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_changes" ADD CONSTRAINT "stock_changes_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma can't describe these, so they live here only.

-- A book always costs something: giving one away is a count fixed by hand,
-- not a sale.
ALTER TABLE "books" ADD CONSTRAINT "books_price_positive" CHECK ("price" > 0);
ALTER TABLE "branch_books" ADD CONSTRAINT "branch_books_price_positive" CHECK ("price" > 0);

-- A shelf can't hold fewer than no copies. A sale takes its copies off in the
-- same write that records it, so this is what stops two people selling the
-- last one.
ALTER TABLE "branch_books" ADD CONSTRAINT "branch_books_stock_not_negative" CHECK ("stock" >= 0);

ALTER TABLE "book_sale_lines" ADD CONSTRAINT "book_sale_lines_sells_something" CHECK (
    "quantity" > 0 AND "unitPrice" > 0
);

-- A delivery adds copies, a correction adds or takes some off, and neither
-- leaves the shelf below zero.
ALTER TABLE "stock_changes" ADD CONSTRAINT "stock_changes_quantity_fits_kind" CHECK (
    ("kind" = 'RECEIVED' AND "quantity" > 0)
    OR ("kind" = 'CORRECTED' AND "quantity" <> 0)
);
ALTER TABLE "stock_changes" ADD CONSTRAINT "stock_changes_stock_after_not_negative" CHECK ("stockAfter" >= 0);
