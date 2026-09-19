const STUDENT_NUMBER = /^\s*stu[\s-]*0*(\d{1,9})\s*$/i;
const SHORT_NUMBER = /^\s*0*(\d{1,5})\s*$/;
const PHONE = /^\+?\d{6,15}$/;

/** 42 -> "STU-00042" */
export function formatStudentNumber(number: number) {
  return `STU-${String(number).padStart(5, "0")}`;
}

/**
 * Strips spaces, dashes, dots and brackets so "061 234-5678" and
 * "0612345678" are stored, and searched, as the same number.
 */
export function normalizePhone(value: string) {
  return value.replace(/[\s\-.()]/g, "");
}

export type StudentLookup =
  | { kind: "number"; number: number }
  | { kind: "phone"; phone: string }
  | { kind: "name"; text: string };

/**
 * Works out what a search box query means. "STU-00042", "stu42" and a short
 * number like "42" are student IDs. Six or more digits is a phone number.
 * Anything else is part of a name.
 */
export function parseStudentLookup(query: string): StudentLookup {
  const idMatch = STUDENT_NUMBER.exec(query) ?? SHORT_NUMBER.exec(query);
  if (idMatch) return { kind: "number", number: Number(idMatch[1]) };

  const phone = normalizePhone(query.trim());
  if (PHONE.test(phone)) return { kind: "phone", phone };

  return { kind: "name", text: query.trim() };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Fees are in US dollars. */
export function formatMoney(value: string | number) {
  return usd.format(Number(value));
}

export function formatMonths(months: number) {
  return months === 1 ? "1 month" : `${months} months`;
}
