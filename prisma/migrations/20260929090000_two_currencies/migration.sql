-- The college keeps two ledgers, US dollars and Somaliland shillings. Every
-- payment and expense so far was in dollars, so each becomes a USD row and no
-- amount changes. A shilling row keeps the exchange rate it was recorded at;
-- a dollar row has none. The money columns widen so large shilling amounts
-- fit: DECIMAL(10,2) stops just under 100 million.

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'SLSH');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD',
ADD COLUMN     "exchangeRate" DECIMAL(10,2),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD',
ADD COLUMN     "exchangeRate" DECIMAL(10,2),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "teacherShare" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "salaryCurrency" "Currency" NOT NULL DEFAULT 'USD',
ALTER COLUMN "fixedSalary" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_createdAt_idx" ON "exchange_rates"("createdAt");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_setById_fkey" FOREIGN KEY ("setById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A shilling amount can only be turned into dollars with the rate it was
-- recorded at, so the database refuses a shilling row without one, and a
-- dollar row with one. Prisma can't describe these, so they live here only.
ALTER TABLE "payments" ADD CONSTRAINT "payments_exchange_rate_matches_currency" CHECK (
    ("currency" = 'USD' AND "exchangeRate" IS NULL)
    OR ("currency" = 'SLSH' AND "exchangeRate" > 0)
);

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_exchange_rate_matches_currency" CHECK (
    ("currency" = 'USD' AND "exchangeRate" IS NULL)
    OR ("currency" = 'SLSH' AND "exchangeRate" > 0)
);

ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_rate_positive" CHECK ("rate" > 0);
