// Sample branches, classes, teachers, skills, students and money for trying
// the app on a local database. Never run this against the college's real
// database.
//
//   pnpm db:seed && pnpm db:demo
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { auth } from "../src/lib/auth";
import { addMonths, collegeToday, monthOf, toDbDate, toDbMonth } from "../src/lib/dates";
import { prisma } from "../src/lib/prisma";

type Method = "CASH" | "ZAAD" | "EDAHAB" | "BANK";

/** Spreads the demo payments across the methods so the day's split isn't flat. */
const methods: Method[] = ["CASH", "ZAAD", "CASH", "EDAHAB", "CASH", "BANK"];
const methodFor = (n: number) => methods[n % methods.length];

/** The months from a start date up to this month, both included. */
function monthsUpToNow(startDate: string, months: number, today: string) {
  const last = [monthOf(addMonths(startDate, months - 1)), monthOf(today)].sort()[0];
  const list: string[] = [];
  for (let month = monthOf(startDate); month <= last; month = monthOf(addMonths(`${month}-01`, 1))) {
    list.push(month);
  }
  return list;
}

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
    data: { name: "Main Branch", phone: "252610000001", address: "Head office" },
  });
  const second = await prisma.branch.create({
    data: { name: "Second Branch", phone: "252610000002" },
  });

  const [lab, room1, roomA, roomB] = await Promise.all([
    prisma.classroom.create({ data: { name: "Computer Lab", branchId: main.id } }),
    prisma.classroom.create({ data: { name: "Room 1", branchId: main.id } }),
    prisma.classroom.create({ data: { name: "Room A", branchId: second.id } }),
    prisma.classroom.create({ data: { name: "Room B", branchId: second.id } }),
  ]);

  // Two teachers on a fixed salary, two on a share of the fees they bring in.
  const teacher = (
    name: string,
    branchIds: string[],
    pay: { salaryType: "FIXED"; fixedSalary: string } | { salaryType: "PERCENTAGE"; percentageRate: string },
  ) =>
    prisma.teacher.create({
      data: { name, ...pay, branches: { create: branchIds.map((branchId) => ({ branchId })) } },
    });
  const [t1, t2, t3, t4] = await Promise.all([
    teacher("Demo Teacher 1", [main.id], { salaryType: "FIXED", fixedSalary: "200" }),
    teacher("Demo Teacher 2", [main.id], { salaryType: "PERCENTAGE", percentageRate: "30" }),
    teacher("Demo Teacher 3", [main.id, second.id], { salaryType: "PERCENTAGE", percentageRate: "25" }),
    teacher("Demo Teacher 4", [second.id], { salaryType: "FIXED", fixedSalary: "150" }),
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
    /** The percentage the teacher earns, or null when they're on a salary. */
    rate: string | null;
  };
  const withSkill = (
    bs: typeof mainComputer,
    s: typeof computer,
    teach: typeof t1,
  ): Offer => ({
    ...bs,
    durationMonths: s.durationMonths,
    registrationFee: s.registrationFee.toString(),
    fee: s.monthlyFee.toString(),
    rate: teach.salaryType === "PERCENTAGE" ? (teach.percentageRate?.toString() ?? null) : null,
  });

  const students: {
    fullName: string;
    sex: "MALE" | "FEMALE";
    phone?: string;
    responsiblePhone?: string;
    homeBranchId: string;
    registered: string;
    skills: {
      offer: Offer;
      start: string;
      /** `paid` means the registration fee was paid on the start date. */
      paid: boolean;
      /** How many months of fees have been paid, oldest first. */
      monthsPaid: number;
      status?: "FINISHED" | "DROPPED";
    }[];
  }[] = [
    {
      fullName: "Demo Student One",
      sex: "FEMALE",
      phone: "252611111111",
      homeBranchId: main.id,
      registered: monthsAgo(1),
      skills: [
        {
          offer: withSkill(mainComputer, computer, t1),
          start: monthsAgo(1),
          paid: true,
          monthsPaid: 2,
        },
        {
          offer: withSkill(mainTailoring, tailoring, t3),
          start: monthsAgo(1),
          paid: true,
          monthsPaid: 1,
        },
      ],
    },
    {
      fullName: "Demo Student Two",
      sex: "MALE",
      responsiblePhone: "0612222222",
      homeBranchId: main.id,
      registered: monthsAgo(5),
      // Started five months ago on a four-month skill: past its end date.
      // Never paid the registration fee, and two months are still owed.
      skills: [
        {
          offer: withSkill(mainDesign, design, t2),
          start: monthsAgo(5),
          paid: false,
          monthsPaid: 2,
        },
      ],
    },
    {
      fullName: "Demo Student Three",
      sex: "FEMALE",
      phone: "252613333333",
      homeBranchId: second.id,
      registered: monthsAgo(2),
      // Registered at the second branch, also taking a skill at the main one,
      // whose registration fee is still unpaid.
      skills: [
        {
          offer: withSkill(secondElectrical, electrical, t3),
          start: monthsAgo(2),
          paid: true,
          monthsPaid: 3,
        },
        {
          offer: withSkill(mainDesign, design, t2),
          start: monthsAgo(1),
          paid: false,
          monthsPaid: 1,
        },
      ],
    },
    {
      fullName: "Demo Student Four",
      sex: "MALE",
      phone: "252614444444",
      homeBranchId: second.id,
      registered: monthsAgo(8),
      skills: [
        {
          offer: withSkill(secondComputer, computer, t4),
          start: monthsAgo(8),
          paid: true,
          monthsPaid: 3,
          status: "FINISHED",
        },
      ],
    },
  ];

  let payments = 0;
  for (const student of students) {
    const created = await prisma.student.create({
      data: {
        fullName: student.fullName,
        sex: student.sex,
        phone: student.phone,
        responsiblePhone: student.responsiblePhone,
        homeBranchId: student.homeBranchId,
        registrationDate: toDbDate(student.registered),
        createdById: admin.id,
      },
    });

    for (const { offer, start, paid, monthsPaid, status } of student.skills) {
      // Created one at a time, not with createMany, because each fee payment
      // needs the id of the enrollment it belongs to.
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: created.id,
          branchSkillId: offer.id,
          skillId: offer.skillId,
          startDate: toDbDate(start),
          endDate: toDbDate(addMonths(start, offer.durationMonths)),
          monthlyFee: offer.fee,
          registrationFee: offer.registrationFee,
          status: status ?? "ACTIVE",
          statusChangedAt: status ? new Date() : null,
          createdById: admin.id,
        },
      });

      if (paid) {
        await prisma.payment.create({
          data: {
            category: "REGISTRATION_FEE",
            method: methodFor(payments++),
            amount: offer.registrationFee,
            paidOn: toDbDate(start),
            branchId: offer.branchId,
            studentId: created.id,
            enrollmentId: enrollment.id,
            recordedById: admin.id,
          },
        });
      }

      // The oldest months are the ones that have been paid; whatever is left
      // shows on the student's page as owed.
      for (const month of monthsUpToNow(start, offer.durationMonths, today).slice(0, monthsPaid)) {
        const share = offer.rate
          ? ((Math.round(Number(offer.fee) * 100 * Number(offer.rate)) / 100) / 100).toFixed(2)
          : null;
        await prisma.payment.create({
          data: {
            category: "MONTHLY_FEE",
            method: methodFor(payments++),
            amount: offer.fee,
            paidOn: toDbDate(`${month}-05` <= today ? `${month}-05` : today),
            forMonth: toDbMonth(month),
            branchId: offer.branchId,
            studentId: created.id,
            enrollmentId: enrollment.id,
            recordedById: admin.id,
            ...(share
              ? { teacherId: offer.teacherId, teacherSharePercent: offer.rate, teacherShare: share }
              : {}),
          },
        });
      }
    }
  }

  // Books sold over the counter, with no student behind them.
  await prisma.payment.create({
    data: {
      category: "BOOKS",
      method: "CASH",
      amount: "30",
      paidOn: toDbDate(today),
      branchId: main.id,
      note: "Two design textbooks",
      recordedById: admin.id,
    },
  });

  // Running costs for this month and last, so the budget has something to
  // compare against.
  const expense = (
    branchId: string,
    category: "RENT" | "ELECTRICITY" | "INTERNET" | "STATIONERY",
    amount: string,
    month: string,
  ) =>
    prisma.expense.create({
      data: {
        category,
        method: "CASH",
        amount,
        spentOn: toDbDate(`${month}-03` <= today ? `${month}-03` : today),
        branchId,
        recordedById: admin.id,
      },
    });
  for (const month of [monthOf(monthsAgo(1)), monthOf(today)]) {
    await expense(main.id, "RENT", "300", month);
    await expense(main.id, "ELECTRICITY", "60", month);
    await expense(main.id, "INTERNET", "35", month);
    await expense(second.id, "RENT", "200", month);
    await expense(second.id, "ELECTRICITY", "40", month);
  }
  await expense(main.id, "STATIONERY", "25", monthOf(today));

  // Last month's salaries went out; this month's haven't yet.
  const lastMonth = monthOf(monthsAgo(1));
  for (const [teach, branchId, amount] of [
    [t1, main.id, "200"],
    [t4, second.id, "150"],
  ] as const) {
    await prisma.expense.create({
      data: {
        category: "TEACHER_SALARY",
        method: "CASH",
        amount,
        spentOn: toDbDate(`${lastMonth}-28` <= today ? `${lastMonth}-28` : today),
        forMonth: toDbMonth(lastMonth),
        branchId,
        teacherId: teach.id,
        recordedById: admin.id,
      },
    });
  }

  // A plan for this month at each branch, to compare against.
  const thisMonth = monthOf(today);
  const plan = (branchId: string, expectedIncome: string, lines: [string, string][]) =>
    prisma.monthlyBudget.create({
      data: {
        branchId,
        month: toDbMonth(thisMonth),
        expectedIncome,
        savedById: admin.id,
        lines: {
          create: lines.map(([category, amount]) => ({
            category: category as "RENT",
            amount,
          })),
        },
      },
    });
  await plan(main.id, "600", [
    ["RENT", "300"],
    ["ELECTRICITY", "70"],
    ["INTERNET", "35"],
    ["TEACHER_SALARY", "250"],
  ]);
  await plan(second.id, "400", [
    ["RENT", "200"],
    ["ELECTRICITY", "40"],
    ["TEACHER_SALARY", "150"],
  ]);

  console.log("Demo data added: 2 branches, 4 skills, 4 teachers, 4 students.");
  console.log(`Money: ${payments + 1} payments, expenses for two months, and this month's budget.`);
  console.log(`Branch staff login for Main Branch: staff@college.local / ${staffPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
