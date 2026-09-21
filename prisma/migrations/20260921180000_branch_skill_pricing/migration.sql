-- Each branch sets its own fees and duration for a skill, so a branch in a
-- poorer city can charge less. Every existing branch skill starts at its
-- skill's current values, so nothing changes until the admin edits one. The
-- skill keeps its values as the defaults a new branch starts from.

-- AlterTable
ALTER TABLE "branch_skills" ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "monthlyFee" DECIMAL(10,2),
ADD COLUMN     "registrationFee" DECIMAL(10,2);

UPDATE "branch_skills" AS bs
SET "durationMonths" = s."durationMonths",
    "monthlyFee" = s."monthlyFee",
    "registrationFee" = s."registrationFee"
FROM "skills" AS s
WHERE s."id" = bs."skillId";

ALTER TABLE "branch_skills" ALTER COLUMN "durationMonths" SET NOT NULL,
ALTER COLUMN "monthlyFee" SET NOT NULL,
ALTER COLUMN "registrationFee" SET NOT NULL;
