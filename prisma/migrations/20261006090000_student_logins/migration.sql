-- Student logins. Staff can give a student a login to the portal, signed into
-- with their Student ID and a password. Each login names its student, and a
-- student has at most one. Every change staff make to it is recorded.

-- CreateEnum
CREATE TYPE "StudentLoginAction" AS ENUM ('CREATED', 'PASSWORD_RESET', 'TURNED_OFF', 'TURNED_ON');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentId" TEXT;

-- CreateTable
CREATE TABLE "student_login_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" "StudentLoginAction" NOT NULL,
    "byId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_login_events_studentId_createdAt_idx" ON "student_login_events"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_studentId_key" ON "user"("studentId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_login_events" ADD CONSTRAINT "student_login_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_login_events" ADD CONSTRAINT "student_login_events_byId_fkey" FOREIGN KEY ("byId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_login_events" ADD CONSTRAINT "student_login_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma can't describe these, so they live here only.

-- A student login names its student, and no other account names one.
ALTER TABLE "user" ADD CONSTRAINT "user_student_set_with_role" CHECK (
    (COALESCE("role", '') = 'student') = ("studentId" IS NOT NULL)
);

-- A student's branches are on their skills, so their login has none.
ALTER TABLE "user" ADD CONSTRAINT "user_student_has_no_branch" CHECK (
    "studentId" IS NULL OR "branchId" IS NULL
);
