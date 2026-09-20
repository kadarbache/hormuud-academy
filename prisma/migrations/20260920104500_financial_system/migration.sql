-- The financial system: every dollar in is a payment, every dollar out is an
-- expense, teachers are paid a fixed salary or a share of the fees they bring
-- in, and each branch plans a budget per month.
--
-- Registration fees move here too. Until now an enrollment carried the day its
-- fee was paid and who recorded it; ADR-0003 said that data would move into a
-- payments table once one existed. This is that move, so there is one place
-- that answers what the college was paid.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'ZAAD', 'EDAHAB', 'BANK');

-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM ('REGISTRATION_FEE', 'MONTHLY_FEE', 'BOOKS', 'EXAMINATION_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'ELECTRICITY', 'TEACHER_SALARY', 'STAFF_SALARY', 'INTERNET', 'STATIONERY', 'TRANSPORTATION', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "fixedSalary" DECIMAL(10,2),
ADD COLUMN     "percentageRate" DECIMAL(5,2),
ADD COLUMN     "salaryType" "SalaryType" NOT NULL DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "category" "IncomeCategory" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT,
    "enrollmentId" TEXT,
    "forMonth" DATE,
    "teacherId" TEXT,
    "teacherSharePercent" DECIMAL(5,2),
    "teacherShare" DECIMAL(10,2),
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "spentOn" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "teacherId" TEXT,
    "forMonth" DATE,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budgets" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "expectedIncome" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "savedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budget_lines" (
    "budgetId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "monthly_budget_lines_pkey" PRIMARY KEY ("budgetId","category")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_number_key" ON "payments"("number");

-- CreateIndex
CREATE INDEX "payments_paidOn_idx" ON "payments"("paidOn");

-- CreateIndex
CREATE INDEX "payments_branchId_paidOn_idx" ON "payments"("branchId", "paidOn");

-- CreateIndex
CREATE INDEX "payments_category_paidOn_idx" ON "payments"("category", "paidOn");

-- CreateIndex
CREATE INDEX "payments_studentId_idx" ON "payments"("studentId");

-- CreateIndex
CREATE INDEX "payments_enrollmentId_idx" ON "payments"("enrollmentId");

-- CreateIndex
CREATE INDEX "payments_teacherId_idx" ON "payments"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_one_registration_fee" ON "payments"("enrollmentId") WHERE (category = 'REGISTRATION_FEE');

-- CreateIndex
CREATE UNIQUE INDEX "payments_one_monthly_fee_per_month" ON "payments"("enrollmentId", "forMonth") WHERE (category = 'MONTHLY_FEE');

-- CreateIndex
CREATE UNIQUE INDEX "expenses_number_key" ON "expenses"("number");

-- CreateIndex
CREATE INDEX "expenses_spentOn_idx" ON "expenses"("spentOn");

-- CreateIndex
CREATE INDEX "expenses_branchId_spentOn_idx" ON "expenses"("branchId", "spentOn");

-- CreateIndex
CREATE INDEX "expenses_category_spentOn_idx" ON "expenses"("category", "spentOn");

-- CreateIndex
CREATE INDEX "expenses_teacherId_idx" ON "expenses"("teacherId");

-- CreateIndex
CREATE INDEX "monthly_budgets_month_idx" ON "monthly_budgets"("month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budgets_branchId_month_key" ON "monthly_budgets"("branchId", "month");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budget_lines" ADD CONSTRAINT "monthly_budget_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "monthly_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every registration fee already recorded as paid becomes a payment. The
-- method wasn't asked for back then, so these land under Cash with a note
-- saying so rather than pretending the college knows. A fee recorded before
-- the "recorded by" column existed is credited to whoever made the enrollment.
INSERT INTO "payments" (
    "id", "category", "method", "amount", "paidOn",
    "branchId", "studentId", "enrollmentId", "note", "recordedById", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    'REGISTRATION_FEE',
    'CASH',
    "enrollments"."registrationFee",
    "enrollments"."registrationFeePaidOn",
    "branch_skills"."branchId",
    "enrollments"."studentId",
    "enrollments"."id",
    'Recorded before the system asked for a payment method.',
    COALESCE("enrollments"."registrationFeeRecordedById", "enrollments"."createdById"),
    "enrollments"."createdAt"
FROM "enrollments"
JOIN "branch_skills" ON "branch_skills"."id" = "enrollments"."branchSkillId"
WHERE "enrollments"."registrationFeePaidOn" IS NOT NULL;

-- The enrollment keeps the fee it owes; whether that fee was paid is now the
-- ledger's answer alone.

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_registrationFeeRecordedById_fkey";

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "registrationFeePaidOn",
DROP COLUMN "registrationFeeRecordedById";
