-- Every payment and expense keeps what it was worth in dollars the day it was
-- recorded: the amount itself for dollars, the shillings at the row's own
-- exchange rate for shillings, to the cent. Like the rest of a receipt it
-- never changes afterwards. Totals don't add these up: they show what the
-- money is worth now, at today's rate.

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "usdValue" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "teacherShareUsdValue" DECIMAL(14,2),
ADD COLUMN     "usdValue" DECIMAL(14,2);

UPDATE "expenses"
SET "usdValue" = CASE
    WHEN "currency" = 'USD' THEN "amount"
    ELSE round("amount" / "exchangeRate", 2)
END;

UPDATE "payments"
SET "usdValue" = CASE
        WHEN "currency" = 'USD' THEN "amount"
        ELSE round("amount" / "exchangeRate", 2)
    END,
    "teacherShareUsdValue" = CASE
        WHEN "teacherShare" IS NULL THEN NULL
        WHEN "currency" = 'USD' THEN "teacherShare"
        ELSE round("teacherShare" / "exchangeRate", 2)
    END;

ALTER TABLE "expenses" ALTER COLUMN "usdValue" SET NOT NULL;

ALTER TABLE "payments" ALTER COLUMN "usdValue" SET NOT NULL;

-- A dollar row is worth its amount. A shilling row is worth its shillings at
-- its own rate: the app rounds to the cent, so anything a cent or more away
-- is a mistake the database refuses. Prisma can't describe these checks, so
-- they live here only.
ALTER TABLE "payments" ADD CONSTRAINT "payments_usd_value_matches_amount" CHECK (
    ("currency" = 'USD' AND "usdValue" = "amount")
    OR ("currency" = 'SLSH' AND abs("usdValue" - "amount" / "exchangeRate") < 0.01)
);

ALTER TABLE "payments" ADD CONSTRAINT "payments_share_usd_value_matches_share" CHECK (
    ("teacherShare" IS NULL AND "teacherShareUsdValue" IS NULL)
    OR (
        "teacherShare" IS NOT NULL
        AND "teacherShareUsdValue" IS NOT NULL
        AND (
            ("currency" = 'USD' AND "teacherShareUsdValue" = "teacherShare")
            OR (
                "currency" = 'SLSH'
                AND abs("teacherShareUsdValue" - "teacherShare" / "exchangeRate") < 0.01
            )
        )
    )
);

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_usd_value_matches_amount" CHECK (
    ("currency" = 'USD' AND "usdValue" = "amount")
    OR ("currency" = 'SLSH' AND abs("usdValue" - "amount" / "exchangeRate") < 0.01)
);
