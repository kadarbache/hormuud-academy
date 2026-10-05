// Imports the Computer Basics students from the paper registration list, from
// a reviewed CSV (imports/computer-students.csv, kept out of git because it
// holds real names and phone numbers). Each student is registered the way the
// app registers one: the student and one enrollment, in one transaction, with
// the fees copied from the branch skill. No payments are written, so every
// registration fee shows as unpaid until staff record it.
//
// It only reads unless --apply is given, and it skips anyone already there, so
// it can be run again. Against a database that isn't local, --apply also needs
// --host <hostname>, typed out, so the wrong database can't be hit by accident.
//
//   pnpm db:import-students                         dry run, prints the plan
//   pnpm db:import-students --apply                 writes to the local database
//   pnpm db:import-students --apply --host <host>   writes to a remote database
//
// Other flags: --file <csv>, --branch <name> (when more than one branch has the
// Computer Lab), --as <email> (who the students are recorded as created by,
// default SEED_ADMIN_EMAIL), --ignore-warnings.
import "dotenv/config";
import fs from "node:fs";
import type { Weekday } from "../src/generated/prisma/client";
import { addMonths, collegeToday, toDbDate } from "../src/lib/dates";
import { formatMoney, formatStudentNumber } from "../src/lib/format";
import { formatPhone, toStoredPhone } from "../src/lib/phone";
import { prisma } from "../src/lib/prisma";

const SKILL_NAME = "Computer Basics";
const ROOM_NAME = "Computer Lab";
/** Everyone on the list registered, and started, on the first of September. */
const REGISTERED_ON = "2026-09-01";
const STARTED_ON = "2026-09-01";
/** The class times on the list, by the hour they start. Every one is a pm class. */
const START_HOURS: Record<string, number> = { "5 pm": 17, "6 pm": 18, "7 pm": 19, "8 pm": 20 };
/** What the branch skill and its class times should look like, from the college's answers. */
const EXPECTED = { durationMonths: 4, registrationFee: 5, monthlyFee: 0, classMinutes: 60 };
const EXPECTED_DAYS: Weekday[] = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY"];

const DAY_LABEL: Record<Weekday, string> = {
  SATURDAY: "Sat",
  SUNDAY: "Sun",
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
};

type Row = {
  row: number;
  name: string;
  sex: "MALE" | "FEMALE";
  phone: string | null;
  responsiblePhone: string | null;
  time: string;
};

function flag(name: string) {
  return process.argv.includes(`--${name}`);
}

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

/** A CSV with quoted fields, as Excel and the review file write it. */
function parseCsv(text: string) {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((value) => value !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((value) => value !== "")) records.push(record);
  }
  return records;
}

function readRows(path: string): Row[] {
  if (!fs.existsSync(path)) fail(`Can't find ${path}.`);
  const [header, ...records] = parseCsv(fs.readFileSync(path, "utf8"));
  const column = (name: string) => {
    const at = header.indexOf(name);
    if (at < 0) fail(`${path} has no "${name}" column.`);
    return at;
  };
  const at = {
    row: column("row"),
    action: column("action"),
    name: column("name"),
    sex: column("sex"),
    phone: column("phone"),
    responsible: column("responsible_phone"),
    time: column("time"),
  };

  const rows: Row[] = [];
  const problems: string[] = [];
  for (const record of records) {
    const action = record[at.action]?.trim();
    if (action !== "import") continue;
    const n = Number(record[at.row]);
    const name = record[at.name].trim().replace(/\s+/g, " ");
    const sex = record[at.sex].trim().toUpperCase();
    const time = record[at.time].trim();
    const phoneText = record[at.phone].trim();
    const responsibleText = record[at.responsible].trim();
    const phone = phoneText ? toStoredPhone(phoneText) : null;
    const responsiblePhone = responsibleText ? toStoredPhone(responsibleText) : null;

    if (!name) problems.push(`Row ${n} has no name.`);
    if (name.length > 120) problems.push(`Row ${n}: the name is over 120 characters.`);
    if (sex !== "MALE" && sex !== "FEMALE") problems.push(`Row ${n} (${name}): sex must be MALE or FEMALE.`);
    if (!(time in START_HOURS)) problems.push(`Row ${n} (${name}): time "${time}" isn't one of ${Object.keys(START_HOURS).join(", ")}.`);
    if (phoneText && !phone) problems.push(`Row ${n} (${name}): the phone "${phoneText}" isn't a Somali mobile.`);
    if (responsibleText && !responsiblePhone) problems.push(`Row ${n} (${name}): the responsible phone "${responsibleText}" isn't a Somali mobile.`);
    // The registration form refuses a student with no phone at all.
    if (!phone && !responsiblePhone) problems.push(`Row ${n} (${name}) has neither a phone nor a responsible phone.`);
    rows.push({ row: n, name, sex: sex as Row["sex"], phone, responsiblePhone, time });
  }
  if (problems.length > 0) fail(`The file needs fixing first:\n  ${problems.join("\n  ")}`);
  return rows;
}

function clock(minute: number) {
  const hour = Math.floor(minute / 60);
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute % 60).padStart(2, "0");
  return `${shown}:${mm} ${hour >= 12 ? "pm" : "am"}`;
}

async function main() {
  const apply = flag("apply");
  const file = option("file") ?? "imports/computer-students.csv";

  const url = new URL(process.env.DATABASE_URL ?? fail("DATABASE_URL isn't set."));
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  console.log(`Database:  ${url.hostname}${url.port ? `:${url.port}` : ""}  (${local ? "local" : "REMOTE"})`);
  if (apply && !local && option("host") !== url.hostname) {
    fail(`This is a remote database. To write to it, run again with --host ${url.hostname}\nif that's the one you mean.`);
  }

  const rows = readRows(file);
  console.log(`File:      ${file}  (${rows.length} students marked import)`);

  const email = (option("as") ?? process.env.SEED_ADMIN_EMAIL)?.trim().toLowerCase();
  if (!email) fail("Say who is registering them: --as <email>, or set SEED_ADMIN_EMAIL.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`There's no user ${email} in this database. Use --as <email> with an account that exists here.`);
  console.log(`Created by: ${user.name} <${user.email}>`);

  // Everything is found from the Computer Lab's Computer Basics class times, so
  // a typed branch name can't disagree with where those classes really are.
  const found = await prisma.classTime.findMany({
    where: {
      active: true,
      // Spelled however the admin typed it: "Computer lab" is the same room.
      classroom: { name: { equals: ROOM_NAME, mode: "insensitive" }, active: true },
      branchSkill: { active: true, skill: { name: { equals: SKILL_NAME, mode: "insensitive" }, active: true } },
    },
    include: {
      teacher: { select: { name: true } },
      classroom: { include: { branch: true } },
      branchSkill: true,
    },
  });
  const branches = [...new Map(found.map((c) => [c.classroom.branch.id, c.classroom.branch])).values()];
  const wanted = option("branch");
  const candidates = wanted ? branches.filter((b) => b.name.toLowerCase() === wanted.toLowerCase()) : branches;
  if (candidates.length === 0) {
    // Show what is there, so a wrong name or an inactive record can be seen at once.
    const similar = await prisma.classTime.findMany({
      where: {
        OR: [
          { classroom: { name: { contains: "computer", mode: "insensitive" } } },
          { branchSkill: { skill: { name: { contains: "computer", mode: "insensitive" } } } },
        ],
      },
      include: {
        classroom: { include: { branch: true } },
        branchSkill: { include: { skill: true } },
      },
      take: 20,
    });
    if (similar.length > 0) {
      console.error("\nComputer class times that do exist:");
      for (const c of similar) {
        const hours = c.startMinute === null || c.endMinute === null ? "no hours set" : `${clock(c.startMinute)}-${clock(c.endMinute)}`;
        const off = [
          c.active ? null : "class time inactive",
          c.classroom.active ? null : "class inactive",
          c.branchSkill.active ? null : "branch skill inactive",
          c.branchSkill.skill.active ? null : "skill inactive",
        ].filter(Boolean);
        console.error(`  ${c.classroom.branch.name} / "${c.classroom.name}" / "${c.branchSkill.skill.name}" / ${hours}${off.length ? `  [${off.join(", ")}]` : ""}`);
      }
    }
    fail(`No active ${SKILL_NAME} class times in a class called "${ROOM_NAME}"${wanted ? ` at ${wanted}` : ""}.`);
  }
  if (candidates.length > 1) {
    fail(`More than one branch has ${SKILL_NAME} in "${ROOM_NAME}": ${candidates.map((b) => b.name).join(", ")}.\nPick one with --branch "<name>".`);
  }
  const branch = candidates[0];
  if (!branch.active) fail(`${branch.name} isn't active.`);
  const classTimes = found.filter((c) => c.classroom.branch.id === branch.id);
  const branchSkill = classTimes[0].branchSkill;

  const warnings: string[] = [];
  const fees = {
    duration: branchSkill.durationMonths,
    registration: Number(branchSkill.registrationFee),
    monthly: Number(branchSkill.monthlyFee),
  };
  console.log(`Branch:    ${branch.name}, class "${classTimes[0].classroom.name}"`);
  console.log(
    `Skill:     ${SKILL_NAME}, ${fees.duration} months, registration ${formatMoney(fees.registration)}, monthly ${formatMoney(fees.monthly)}`,
  );
  if (fees.duration !== EXPECTED.durationMonths) warnings.push(`Duration is ${fees.duration} months, expected ${EXPECTED.durationMonths}.`);
  if (fees.registration !== EXPECTED.registrationFee) warnings.push(`Registration fee is ${formatMoney(fees.registration)}, expected ${formatMoney(EXPECTED.registrationFee)}.`);
  if (fees.monthly !== EXPECTED.monthlyFee) warnings.push(`Monthly fee is ${formatMoney(fees.monthly)}, expected ${formatMoney(EXPECTED.monthlyFee)}.`);
  const endDate = addMonths(STARTED_ON, branchSkill.durationMonths);
  console.log(`Dates:     registered ${REGISTERED_ON}, started ${STARTED_ON}, ends ${endDate}`);
  if (REGISTERED_ON > collegeToday()) warnings.push("The registration date is in the future.");

  // One class time per hour of the day, or the list can't say which to use.
  const classTimeFor: Record<string, (typeof classTimes)[number]> = {};
  console.log("\nClass times:");
  for (const [label, hour] of Object.entries(START_HOURS)) {
    const matches = classTimes.filter((c) => c.startMinute === hour * 60);
    if (matches.length !== 1) {
      const have = classTimes.map((c) => (c.startMinute === null ? "no hours set" : clock(c.startMinute))).join(", ");
      fail(`${matches.length === 0 ? "No" : "More than one"} ${SKILL_NAME} class time in ${ROOM_NAME} starts at ${clock(hour * 60)}. It has: ${have || "none"}.`);
    }
    const [time] = matches;
    classTimeFor[label] = time;
    const length = (time.endMinute ?? 0) - (time.startMinute ?? 0);
    if (length !== EXPECTED.classMinutes) warnings.push(`${label} class time is ${length} minutes long, expected ${EXPECTED.classMinutes}.`);
    if (EXPECTED_DAYS.join() !== time.days.join()) warnings.push(`${label} class time runs ${time.days.map((d) => DAY_LABEL[d]).join(" ") || "no days"}, expected ${EXPECTED_DAYS.map((d) => DAY_LABEL[d]).join(" ")}.`);
    const count = rows.filter((r) => r.time === label).length;
    console.log(
      `  ${label.padEnd(5)} ${clock(time.startMinute ?? 0)}-${clock(time.endMinute ?? 0)}  ${time.days.map((d) => DAY_LABEL[d]).join(" ")}  ${time.teacher.name}  <- ${count} students`,
    );
  }

  // Someone is already there if they have the same name and share a phone number.
  const existing = await prisma.student.findMany({
    where: {
      homeBranchId: branch.id,
      OR: rows.map((r) => ({ fullName: { equals: r.name, mode: "insensitive" as const } })),
    },
    select: { fullName: true, phone: true, responsiblePhone: true, number: true },
  });
  const alreadyThere = (r: Row) =>
    existing.find((s) => {
      if (s.fullName.toLowerCase() !== r.name.toLowerCase()) return false;
      const theirs = [s.phone, s.responsiblePhone].filter(Boolean);
      return [r.phone, r.responsiblePhone].some((p) => p && theirs.includes(p));
    });
  const skipped = rows.filter((r) => alreadyThere(r));
  const todo = rows.filter((r) => !alreadyThere(r));

  console.log(`\nStudents (${todo.length} to create${skipped.length ? `, ${skipped.length} already in the app` : ""}):`);
  for (const r of todo) {
    console.log(
      `  #${String(r.row).padStart(2)}  ${r.name.padEnd(30)} ${r.sex === "MALE" ? "M" : "F"}  ${r.time.padEnd(5)} ${formatPhone(r.phone).padEnd(16)} ${formatPhone(r.responsiblePhone)}`,
    );
  }
  for (const r of skipped) {
    const there = alreadyThere(r);
    console.log(`  skip  ${r.name} is already ${there ? formatStudentNumber(there.number) : "there"}`);
  }

  const owed = todo.length * fees.registration;
  console.log(
    `\nAfter this: ${todo.length} enrollments in ${SKILL_NAME}, no payments written, so ${todo.length} registration fees show as unpaid (${formatMoney(owed)} owed).`,
  );
  if (warnings.length > 0) {
    console.log(`\nWarnings:\n  ${warnings.join("\n  ")}`);
  }

  if (!apply) {
    console.log("\nDry run. Nothing was written. Run again with --apply to write these.");
    return;
  }
  if (warnings.length > 0 && !flag("ignore-warnings")) {
    fail("Not writing while there are warnings. Fix them, or run again with --ignore-warnings.");
  }
  if (todo.length === 0) {
    console.log("\nNothing to write.");
    return;
  }

  // In the order of the list, so student numbers follow it. One transaction per
  // student, so a failure part-way leaves whole students, and a re-run carries on.
  let created = 0;
  const numbers: number[] = [];
  for (const r of todo) {
    const time = classTimeFor[r.time];
    const student = await prisma.$transaction(async (tx) => {
      const made = await tx.student.create({
        data: {
          fullName: r.name,
          sex: r.sex,
          phone: r.phone,
          responsiblePhone: r.responsiblePhone,
          registrationDate: toDbDate(REGISTERED_ON),
          homeBranchId: branch.id,
          createdById: user.id,
        },
      });
      await tx.enrollment.create({
        data: {
          studentId: made.id,
          branchSkillId: branchSkill.id,
          classTimeId: time.id,
          skillId: branchSkill.skillId,
          startDate: toDbDate(STARTED_ON),
          endDate: toDbDate(endDate),
          // Copied now, like a registration, so a later price change leaves them alone.
          monthlyFee: branchSkill.monthlyFee,
          registrationFee: branchSkill.registrationFee,
          createdById: user.id,
        },
      });
      return made;
    });
    numbers.push(student.number);
    created++;
  }
  console.log(
    `\nCreated ${created} students, ${formatStudentNumber(Math.min(...numbers))} to ${formatStudentNumber(Math.max(...numbers))}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
