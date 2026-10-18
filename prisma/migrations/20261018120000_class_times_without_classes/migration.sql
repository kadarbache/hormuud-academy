-- Class times without classes. The app stops keeping the room a class time
-- meets in. Some skills have about 20 students at one hour, taught as two
-- class times by the same teacher, sharing the Computer lab and a theory
-- room by turns, and keeping which one was where made attendance hard. Each class
-- time gets a short name instead, which tells it apart from the skill's
-- other class times at its branch: "Computer Basics 1".
--
-- The class times already set up are named 1, 2, 3 and on for each branch
-- skill, in the order they start; one with no hours yet comes last. The list
-- of classes is deleted, and with it the class each class time was in.
-- Students, attendance and fees don't change.

-- AlterTable
ALTER TABLE "class_times" ADD COLUMN     "name" TEXT;

UPDATE "class_times"
SET "name" = "numbered"."n"::text
FROM (
    SELECT "id", row_number() OVER (
        PARTITION BY "branchSkillId"
        ORDER BY "startMinute" NULLS LAST, "createdAt", "id"
    ) AS "n"
    FROM "class_times"
) AS "numbered"
WHERE "numbered"."id" = "class_times"."id";

ALTER TABLE "class_times" ALTER COLUMN "name" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "class_times" DROP CONSTRAINT "class_times_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "classrooms" DROP CONSTRAINT "classrooms_branchId_fkey";

-- DropIndex
DROP INDEX "class_times_classroomId_idx";

-- AlterTable
ALTER TABLE "class_times" DROP COLUMN "classroomId";

-- DropTable
DROP TABLE "classrooms";

-- CreateIndex
CREATE UNIQUE INDEX "class_times_branchSkillId_name_key" ON "class_times"("branchSkillId", "name");

-- Prisma can't describe this, so it lives here only.

-- A name is never blank.
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_name_not_blank" CHECK (
    length(btrim("name")) > 0
);
