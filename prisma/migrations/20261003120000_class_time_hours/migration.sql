-- Class times set their own hours. Fixed shifts made every class at a branch
-- fit the same blocks, so a one-hour class couldn't share an afternoon with
-- a two-hour one. Each class time now keeps its own start and end, and the
-- shifts go. A class time that had a shift keeps that shift's hours; one
-- still waiting for a time keeps waiting.

-- AlterTable
ALTER TABLE "class_times" ADD COLUMN     "endMinute" INTEGER,
ADD COLUMN     "startMinute" INTEGER;

UPDATE "class_times"
SET "startMinute" = "shifts"."startMinute", "endMinute" = "shifts"."endMinute"
FROM "shifts"
WHERE "shifts"."id" = "class_times"."shiftId";

ALTER TABLE "class_times" DROP CONSTRAINT "class_times_shift_and_days_together";

-- DropForeignKey
ALTER TABLE "class_times" DROP CONSTRAINT "class_times_shiftId_fkey";

-- DropIndex
DROP INDEX "class_times_shiftId_idx";

-- AlterTable
ALTER TABLE "class_times" DROP COLUMN "shiftId";

-- DropTable
DROP TABLE "shifts";

-- A class time starts before it ends, both within the day, in minutes after
-- midnight.
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_hours_in_order" CHECK (
    "startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440
);

-- A class time has a start, an end and at least one day, or none of them
-- while it's waiting for the admin to set them.
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_time_set_together" CHECK (
    ("startMinute" IS NULL) = ("endMinute" IS NULL)
    AND ("startMinute" IS NULL) = (coalesce(cardinality("days"), 0) = 0)
);
