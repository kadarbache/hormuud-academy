// Sample branches, classes, teachers, skills and students for trying the app
// on a local database. Never run this against the college's real database.
//
//   pnpm db:seed && pnpm db:demo
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { auth } from "../src/lib/auth";
import { addMonths, collegeToday, toDbDate } from "../src/lib/dates";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (await prisma.branch.count()) {
    console.log("The database already has branches. Demo data is only for an empty database.");
    return;
  }
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) throw new Error("Run pnpm db:seed first to create the admin.");

  const tech = await prisma.category.findUniqueOrThrow({ where: { name: "Technology Skills" } });
  const hand = await prisma.category.findUniqueOrThrow({ where: { name: "Hand Skills" } });

  const main = await prisma.branch.create({
    data: { name: "Main Branch", phone: "0610000001", address: "Head office" },
  });
  const second = await prisma.branch.create({
    data: { name: "Second Branch", phone: "0610000002" },
  });

  const [lab, room1, roomA, roomB] = await Promise.all([
    prisma.classroom.create({ data: { name: "Computer Lab", branchId: main.id } }),
    prisma.classroom.create({ data: { name: "Room 1", branchId: main.id } }),
    prisma.classroom.create({ data: { name: "Room A", branchId: second.id } }),
    prisma.classroom.create({ data: { name: "Room B", branchId: second.id } }),
  ]);

  const teacher = (name: string, branchIds: string[]) =>
    prisma.teacher.create({
      data: { name, branches: { create: branchIds.map((branchId) => ({ branchId })) } },
    });
  const [t1, t2, t3, t4] = await Promise.all([
    teacher("Demo Teacher 1", [main.id]),
    teacher("Demo Teacher 2", [main.id]),
    teacher("Demo Teacher 3", [main.id, second.id]),
    teacher("Demo Teacher 4", [second.id]),
  ]);

  const skill = (
    name: string,
    categoryId: string,
    durationMonths: number,
    registrationFee: string,
    monthlyFee: string,
  ) => prisma.skill.create({ data: { name, categoryId, durationMonths, registrationFee, monthlyFee } });
  const [computer, design, tailoring, electrical] = await Promise.all([
    skill("Computer Basics", tech.id, 3, "10", "20"),
    skill("Graphic Design", tech.id, 4, "15", "30"),
    skill("Tailoring", hand.id, 6, "5", "15"),
    skill("Electrical Installation", hand.id, 6, "10", "25"),
  ]);

  const offer = (skillId: string, branchId: string, teacherId: string, classroomId: string) =>
    prisma.branchSkill.create({ data: { skillId, branchId, teacherId, classroomId } });
  const [mainComputer, mainDesign, mainTailoring, secondComputer, secondElectrical] = await Promise.all([
    offer(computer.id, main.id, t1.id, lab.id),
    offer(design.id, main.id, t2.id, lab.id),
    offer(tailoring.id, main.id, t3.id, room1.id),
    offer(computer.id, second.id, t4.id, roomA.id),
    offer(electrical.id, second.id, t3.id, roomB.id),
  ]);

  const staffPassword = randomBytes(9).toString("base64url");
  await auth.api.createUser({
    body: {
      name: "Main Branch Staff",
      email: "staff@college.local",
      password: staffPassword,
      role: "staff",
      data: { branchId: main.id },
    },
  });

  const today = collegeToday();
  const monthsAgo = (months: number) => addMonths(today, -months);
  type Offer = typeof mainComputer & {
    durationMonths: number;
    registrationFee: string;
    fee: string;
  };
  const withSkill = (bs: typeof mainComputer, s: typeof computer): Offer => ({
    ...bs,
    durationMonths: s.durationMonths,
    registrationFee: s.registrationFee.toString(),
    fee: s.monthlyFee.toString(),
  });

  const students: {
    fullName: string;
    sex: "MALE" | "FEMALE";
    phone?: string;
    responsiblePhone?: string;
    homeBranchId: string;
    registered: string;
    /** `paid` means the registration fee was paid on the start date. */
    skills: { offer: Offer; start: string; paid: boolean; status?: "FINISHED" | "DROPPED" }[];
  }[] = [
    {
      fullName: "Demo Student One",
      sex: "FEMALE",
      phone: "0611111111",
      homeBranchId: main.id,
      registered: monthsAgo(1),
      skills: [
        { offer: withSkill(mainComputer, computer), start: monthsAgo(1), paid: true },
        { offer: withSkill(mainTailoring, tailoring), start: monthsAgo(1), paid: true },
      ],
    },
    {
      fullName: "Demo Student Two",
      sex: "MALE",
      responsiblePhone: "0612222222",
      homeBranchId: main.id,
      registered: monthsAgo(5),
      // Started five months ago on a four-month skill: past its end date.
      // Never paid the registration fee.
      skills: [{ offer: withSkill(mainDesign, design), start: monthsAgo(5), paid: false }],
    },
    {
      fullName: "Demo Student Three",
      sex: "FEMALE",
      phone: "0613333333",
      homeBranchId: second.id,
      registered: monthsAgo(2),
      // Registered at the second branch, also taking a skill at the main one,
      // whose registration fee is still unpaid.
      skills: [
        { offer: withSkill(secondElectrical, electrical), start: monthsAgo(2), paid: true },
        { offer: withSkill(mainDesign, design), start: monthsAgo(1), paid: false },
      ],
    },
    {
      fullName: "Demo Student Four",
      sex: "MALE",
      phone: "0614444444",
      homeBranchId: second.id,
      registered: monthsAgo(8),
      skills: [
        {
          offer: withSkill(secondComputer, computer),
          start: monthsAgo(8),
          paid: true,
          status: "FINISHED",
        },
      ],
    },
  ];

  for (const student of students) {
    await prisma.student.create({
      data: {
        fullName: student.fullName,
        sex: student.sex,
        phone: student.phone,
        responsiblePhone: student.responsiblePhone,
        homeBranchId: student.homeBranchId,
        registrationDate: toDbDate(student.registered),
        createdById: admin.id,
        enrollments: {
          create: student.skills.map(({ offer, start, paid, status }) => ({
            branchSkillId: offer.id,
            skillId: offer.skillId,
            startDate: toDbDate(start),
            endDate: toDbDate(addMonths(start, offer.durationMonths)),
            monthlyFee: offer.fee,
            registrationFee: offer.registrationFee,
            registrationFeePaidOn: paid ? toDbDate(start) : null,
            registrationFeeRecordedById: paid ? admin.id : null,
            status: status ?? "ACTIVE",
            statusChangedAt: status ? new Date() : null,
            createdById: admin.id,
          })),
        },
      },
    });
  }

  console.log("Demo data added: 2 branches, 4 skills, 4 teachers, 4 students.");
  console.log(`Branch staff login for Main Branch: staff@college.local / ${staffPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
