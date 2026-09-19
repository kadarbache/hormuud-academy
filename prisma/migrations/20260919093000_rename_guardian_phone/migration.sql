-- The screens call it the responsible person's phone, so the column does too.
-- A rename, not drop-and-add, so existing numbers are kept.
ALTER TABLE "students" RENAME COLUMN "guardianPhone" TO "responsiblePhone";

-- RenameIndex
ALTER INDEX "students_guardianPhone_idx" RENAME TO "students_responsiblePhone_idx";
