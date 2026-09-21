import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { photoUploadEnabled } from "@/lib/cloudinary";
import { collegeToday, fromDbDate } from "@/lib/dates";
import { formatStudentNumber } from "@/lib/format";
import { phoneEntry } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canEditStudent } from "../../access";
import { updateStudent } from "../../actions";
import { EditStudentForm } from "./edit-form";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) notFound();
  if (!canEditStudent(user, student)) redirect(`/students/${id}`);

  const branches =
    user.role === "admin"
      ? await prisma.branch.findMany({
          where: { OR: [{ active: true }, { id: student.homeBranchId }] },
          orderBy: { name: "asc" },
        })
      : null;

  return (
    <>
      <PageHeader
        title={`Edit ${student.fullName}`}
        description={`${formatStudentNumber(student.number)}. The ID never changes.`}
      />
      <EditStudentForm
        action={updateStudent.bind(null, student.id)}
        studentId={student.id}
        defaults={{
          fullName: student.fullName,
          sex: student.sex,
          phone: phoneEntry(student.phone),
          responsiblePhone: phoneEntry(student.responsiblePhone),
          registrationDate: fromDbDate(student.registrationDate),
          homeBranchId: student.homeBranchId,
          photoUrl: student.photoUrl,
        }}
        branches={branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? null}
        today={collegeToday()}
        photoEnabled={photoUploadEnabled()}
      />
    </>
  );
}
