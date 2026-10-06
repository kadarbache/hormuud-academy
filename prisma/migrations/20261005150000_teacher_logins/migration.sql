-- Teacher logins. The admin can give a teacher a login of their own, made on
-- Staff accounts with the role "teacher", to take their own class times'
-- attendance and see their own pay. Each login names its teacher, and a
-- teacher has at most one.

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "teacherId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_teacherId_key" ON "user"("teacherId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma can't describe these, so they live here only.

-- A teacher login names its teacher, and no other account names one.
ALTER TABLE "user" ADD CONSTRAINT "user_teacher_set_with_role" CHECK (
    (COALESCE("role", '') = 'teacher') = ("teacherId" IS NOT NULL)
);

-- A teacher's branches are on the teacher, so their login has none.
ALTER TABLE "user" ADD CONSTRAINT "user_teacher_has_no_branch" CHECK (
    "teacherId" IS NULL OR "branchId" IS NULL
);
