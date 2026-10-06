-- Teacher passwords. Every teacher gets a Teacher ID, TCH-00001 upward, and
-- a teacher login can sign in with it and a password as well as with Google.
-- A temporary password from the admin stops working after 48 hours, and
-- every password change and every sign-in is recorded.

-- CreateEnum
CREATE TYPE "TeacherLoginAction" AS ENUM ('PASSWORD_GIVEN', 'PASSWORD_RESET', 'PASSWORD_REMOVED', 'PASSWORD_CHANGED', 'SIGNED_IN_WITH_PASSWORD', 'SIGNED_IN_WITH_GOOGLE');

-- AlterTable
-- Prisma would write `ADD COLUMN "number" SERIAL NOT NULL`, which numbers the
-- existing teachers in whatever order Postgres keeps them. Numbered here in
-- the order they were added instead, then the sequence carries on after.
ALTER TABLE "teachers" ADD COLUMN     "number" INTEGER;

UPDATE "teachers" SET "number" = numbered.n
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "teachers") AS numbered
WHERE "teachers"."id" = numbered."id";

CREATE SEQUENCE "teachers_number_seq" AS INTEGER OWNED BY "teachers"."number";
SELECT setval('"teachers_number_seq"', COALESCE((SELECT MAX("number") FROM "teachers"), 0) + 1, false);

ALTER TABLE "teachers" ALTER COLUMN "number" SET DEFAULT nextval('"teachers_number_seq"'),
ALTER COLUMN "number" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "temporaryPasswordExpires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "teacher_login_events" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "action" "TeacherLoginAction" NOT NULL,
    "byId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_login_events_teacherId_createdAt_idx" ON "teacher_login_events"("teacherId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_number_key" ON "teachers"("number");

-- AddForeignKey
ALTER TABLE "teacher_login_events" ADD CONSTRAINT "teacher_login_events_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_login_events" ADD CONSTRAINT "teacher_login_events_byId_fkey" FOREIGN KEY ("byId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
