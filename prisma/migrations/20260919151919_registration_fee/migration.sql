-- Each skill has a registration fee, paid once for every enrollment on top of
-- the monthly fee. Skills and enrollments that exist already start at 0, so
-- nobody is shown as owing a fee the college never recorded. The default is
-- dropped straight after: every new row must set its own fee.

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "registrationFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "skills" ALTER COLUMN "registrationFee" DROP DEFAULT;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "registrationFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "registrationFeePaidOn" DATE,
ADD COLUMN     "registrationFeeRecordedById" TEXT;
ALTER TABLE "enrollments" ALTER COLUMN "registrationFee" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_registrationFeeRecordedById_fkey" FOREIGN KEY ("registrationFeeRecordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
