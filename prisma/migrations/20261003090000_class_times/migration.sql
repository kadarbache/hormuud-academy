-- Class times. A class can host different skills in different shifts, and a
-- skill can run more than once at a branch, each time in its own class with
-- its own teacher. So the teacher and class move off the branch skill onto
-- its class times, and every enrollment names the class time it's in.
--
-- Every branch skill already set up becomes one class time, in the class and
-- with the teacher it had, and its students all go into it. Those class times
-- have no shift or days yet: the admin sets them once the branch's shifts
-- are listed.

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_times" (
    "id" TEXT NOT NULL,
    "branchSkillId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "shiftId" TEXT,
    "days" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[],
    "teacherId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_times_pkey" PRIMARY KEY ("id")
);

-- One class time for every branch skill, where it was taught and by whom.
INSERT INTO "class_times" ("id", "branchSkillId", "classroomId", "teacherId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "classroomId", "teacherId", "createdAt", CURRENT_TIMESTAMP
FROM "branch_skills";

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "classTimeId" TEXT;

-- Each enrollment goes into its branch skill's one class time.
UPDATE "enrollments"
SET "classTimeId" = "class_times"."id"
FROM "class_times"
WHERE "class_times"."branchSkillId" = "enrollments"."branchSkillId";

ALTER TABLE "enrollments" ALTER COLUMN "classTimeId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "branch_skills" DROP CONSTRAINT "branch_skills_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "branch_skills" DROP CONSTRAINT "branch_skills_teacherId_fkey";

-- AlterTable
ALTER TABLE "branch_skills" DROP COLUMN "classroomId",
DROP COLUMN "teacherId";

-- CreateIndex
CREATE UNIQUE INDEX "shifts_branchId_startMinute_endMinute_key" ON "shifts"("branchId", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "class_times_branchSkillId_idx" ON "class_times"("branchSkillId");

-- CreateIndex
CREATE INDEX "class_times_classroomId_idx" ON "class_times"("classroomId");

-- CreateIndex
CREATE INDEX "class_times_shiftId_idx" ON "class_times"("shiftId");

-- CreateIndex
CREATE INDEX "class_times_teacherId_idx" ON "class_times"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "class_times_id_branchSkillId_key" ON "class_times"("id", "branchSkillId");

-- CreateIndex
CREATE INDEX "enrollments_classTimeId_status_idx" ON "enrollments"("classTimeId", "status");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_branchSkillId_fkey" FOREIGN KEY ("branchSkillId") REFERENCES "branch_skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_classTimeId_branchSkillId_fkey" FOREIGN KEY ("classTimeId", "branchSkillId") REFERENCES "class_times"("id", "branchSkillId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A shift starts before it ends, both within the day, in minutes after midnight.
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_hours_in_order" CHECK (
    "startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440
);

-- A class time has a shift and at least one day, or neither while it's
-- waiting for the admin to set them.
ALTER TABLE "class_times" ADD CONSTRAINT "class_times_shift_and_days_together" CHECK (
    ("shiftId" IS NULL) = (coalesce(cardinality("days"), 0) = 0)
);
