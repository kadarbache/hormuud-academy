-- Attendance. Branch staff and the admin take a class time's attendance on
-- each of its days: one sheet per class time per day, listing everyone in it
-- that day with a mark. A mark belongs to the enrollment and its sheet to the
-- class time, so moving a student later leaves their past marks where they
-- were taken.

-- CreateEnum
CREATE TYPE "AttendanceMark" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateTable
CREATE TABLE "attendance_sheets" (
    "id" TEXT NOT NULL,
    "classTimeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "takenById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3),

    CONSTRAINT "attendance_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_entries" (
    "sheetId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "mark" "AttendanceMark" NOT NULL,

    CONSTRAINT "attendance_entries_pkey" PRIMARY KEY ("sheetId","enrollmentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sheets_classTimeId_date_key" ON "attendance_sheets"("classTimeId", "date");

-- CreateIndex
CREATE INDEX "attendance_entries_enrollmentId_idx" ON "attendance_entries"("enrollmentId");

-- AddForeignKey
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_classTimeId_fkey" FOREIGN KEY ("classTimeId") REFERENCES "class_times"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "attendance_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma can't describe this, so it lives here only.

-- A sheet names who last changed it and when, or neither.
ALTER TABLE "attendance_sheets" ADD CONSTRAINT "attendance_sheets_changed_together" CHECK (
    ("changedById" IS NULL) = ("changedAt" IS NULL)
);
