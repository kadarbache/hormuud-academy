import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { photoUploadEnabled } from "@/lib/cloudinary";
import { collegeToday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { enrollableBranchSkills } from "../queries";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { title: "Register student" };

export default async function NewStudentPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const [branches, fixedBranch, branchSkills] = await Promise.all([
    isAdmin ? prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : null,
    user.branchId
      ? prisma.branch.findUnique({ where: { id: user.branchId }, select: { id: true, name: true } })
      : null,
    enrollableBranchSkills(isAdmin ? undefined : (user.branchId ?? undefined)),
  ]);

  return (
    <>
      <PageHeader
        title="Register student"
        description="Add a new student and the skills they're starting."
      />
      <RegistrationForm
        branches={branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? null}
        fixedBranch={isAdmin ? null : fixedBranch}
        branchSkills={branchSkills}
        today={collegeToday()}
        photoEnabled={photoUploadEnabled()}
      />
    </>
  );
}
