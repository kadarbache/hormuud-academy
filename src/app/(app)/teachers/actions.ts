"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject, money, optionalPhone, percent, requiredText } from "@/lib/validation";

const teacherSchema = z
  .object({
    name: requiredText("Enter the teacher's name.", 100),
    phone: optionalPhone,
    branchIds: z.array(z.string().min(1)).min(1, "Pick at least one branch."),
    salaryType: z.enum(["FIXED", "PERCENTAGE"], { error: "Pick how this teacher is paid." }),
    fixedSalary: z.string().optional(),
    percentageRate: z.string().optional(),
  })
  // Only the field that belongs to the chosen way of paying is checked, and
  // the other is cleared, so a teacher never carries both a salary and a rate.
  .transform((values, ctx) => {
    if (values.salaryType === "FIXED") {
      const salary = money("Enter the monthly salary.").safeParse(values.fixedSalary ?? "");
      if (!salary.success) {
        ctx.addIssue({ code: "custom", path: ["fixedSalary"], message: "Enter the monthly salary." });
        return z.NEVER;
      }
      return { ...values, fixedSalary: salary.data, percentageRate: null };
    }

    const rate = percent("Enter the percentage they earn.").safeParse(values.percentageRate ?? "");
    if (!rate.success || Number(rate.data) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["percentageRate"],
        message: "Enter a percentage above 0 and up to 100.",
      });
      return z.NEVER;
    }
    return { ...values, fixedSalary: null, percentageRate: rate.data };
  });

function readTeacher(formData: FormData) {
  return teacherSchema.safeParse({
    ...formObject(formData),
    branchIds: formData.getAll("branchIds"),
  });
}

async function unknownBranches(branchIds: string[]) {
  const found = await prisma.branch.count({ where: { id: { in: branchIds } } });
  return found !== new Set(branchIds).size;
}

export async function createTeacher(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readTeacher(formData);
  if (!parsed.success) return invalid(parsed.error);
  const { name, phone, branchIds, salaryType, fixedSalary, percentageRate } = parsed.data;
  if (await unknownBranches(branchIds)) return failure("One of those branches no longer exists.");

  await prisma.teacher.create({
    data: {
      name,
      phone,
      salaryType,
      fixedSalary,
      percentageRate,
      branches: { create: [...new Set(branchIds)].map((branchId) => ({ branchId })) },
    },
  });

  refresh();
  return success(`${name} added.`);
}

export async function updateTeacher(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = readTeacher(formData);
  if (!parsed.success) return invalid(parsed.error);
  const { name, phone, branchIds, salaryType, fixedSalary, percentageRate } = parsed.data;
  if (await unknownBranches(branchIds)) return failure("One of those branches no longer exists.");

  // Unticking a branch where this teacher still runs a skill would leave that
  // skill with a teacher who doesn't work there.
  const stillTeaching = await prisma.branchSkill.findFirst({
    where: { teacherId: id, branchId: { notIn: branchIds } },
    include: { skill: { select: { name: true } }, branch: { select: { name: true } } },
  });
  if (stillTeaching) {
    return failure("Check the highlighted fields.", {
      branchIds: [
        `${name} still teaches ${stillTeaching.skill.name} at ${stillTeaching.branch.name}. Give that skill another teacher first.`,
      ],
    });
  }

  // Changing the rate only changes what this teacher earns from here on:
  // every share already recorded keeps the rate it was worked out at.
  await prisma.$transaction([
    prisma.teacher.update({
      where: { id },
      data: { name, phone, salaryType, fixedSalary, percentageRate },
    }),
    prisma.teacherBranch.deleteMany({ where: { teacherId: id, branchId: { notIn: branchIds } } }),
    prisma.teacherBranch.createMany({
      data: branchIds.map((branchId) => ({ teacherId: id, branchId })),
      skipDuplicates: true,
    }),
  ]);

  refresh();
  return success("Teacher saved.");
}

export async function setTeacherActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();

  if (!active) {
    const teaching = await prisma.branchSkill.findFirst({
      where: { teacherId: id, active: true },
      include: { skill: { select: { name: true } }, branch: { select: { name: true } } },
    });
    if (teaching) {
      return failure(
        `This teacher still runs ${teaching.skill.name} at ${teaching.branch.name}. Give that skill another teacher first.`,
      );
    }
  }

  const teacher = await prisma.teacher.update({ where: { id }, data: { active } });
  refresh();
  return success(active ? `${teacher.name} is active again.` : `${teacher.name} deactivated.`);
}

export async function deleteTeacher(id: string): Promise<ActionResult> {
  await requireAdmin();
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { _count: { select: { branchSkills: true, payments: true, payouts: true } } },
  });
  if (!teacher) return failure("That teacher no longer exists.");
  if (teacher._count.branchSkills > 0) {
    return failure("This teacher is set on a skill. Deactivate them instead.");
  }
  // Deleting them would take their earnings and their pay out of the books.
  if (teacher._count.payments > 0 || teacher._count.payouts > 0) {
    return failure("This teacher has money on record. Deactivate them instead.");
  }

  await prisma.teacher.delete({ where: { id } });
  refresh();
  return success(`${teacher.name} deleted.`);
}
