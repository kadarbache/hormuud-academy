-- Expense categories become a list the admin keeps, instead of a fixed set.
-- The nine that were fixed become its first rows, with ids made from their
-- old codes, so every expense and budget line keeps its category. Teacher
-- salary keeps the id "teacher_salary" for good: teacher pay is found by it.

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

INSERT INTO "expense_categories" ("id", "name", "updatedAt") VALUES
    ('rent', 'Rent', CURRENT_TIMESTAMP),
    ('electricity', 'Electricity', CURRENT_TIMESTAMP),
    ('teacher_salary', 'Teacher salary', CURRENT_TIMESTAMP),
    ('staff_salary', 'Staff salary', CURRENT_TIMESTAMP),
    ('internet', 'Internet', CURRENT_TIMESTAMP),
    ('stationery', 'Stationery', CURRENT_TIMESTAMP),
    ('transportation', 'Transportation', CURRENT_TIMESTAMP),
    ('maintenance', 'Maintenance', CURRENT_TIMESTAMP),
    ('other', 'Other expenses', CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "categoryId" TEXT;

UPDATE "expenses" SET "categoryId" = lower("category"::text);

ALTER TABLE "expenses" ALTER COLUMN "categoryId" SET NOT NULL;

-- DropIndex
DROP INDEX "expenses_category_spentOn_idx";

ALTER TABLE "expenses" DROP COLUMN "category";

-- AlterTable
ALTER TABLE "monthly_budget_lines" DROP CONSTRAINT "monthly_budget_lines_pkey",
ADD COLUMN     "categoryId" TEXT;

UPDATE "monthly_budget_lines" SET "categoryId" = lower("category"::text);

ALTER TABLE "monthly_budget_lines" ALTER COLUMN "categoryId" SET NOT NULL,
DROP COLUMN "category",
ADD CONSTRAINT "monthly_budget_lines_pkey" PRIMARY KEY ("budgetId", "categoryId");

-- DropEnum
DROP TYPE "ExpenseCategory";

-- CreateIndex
CREATE INDEX "expenses_categoryId_spentOn_idx" ON "expenses"("categoryId", "spentOn");

-- CreateIndex
CREATE INDEX "monthly_budget_lines_categoryId_idx" ON "monthly_budget_lines"("categoryId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budget_lines" ADD CONSTRAINT "monthly_budget_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
