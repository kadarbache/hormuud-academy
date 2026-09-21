import { phoneSearch } from "@/lib/phone";

const STUDENT_NUMBER = /^\s*stu[\s-]*0*(\d{1,9})\s*$/i;
const SHORT_NUMBER = /^\s*0*(\d{1,5})\s*$/;
const PHONE = /^\+?[\d\s\-.()]{6,20}$/;

/** 42 -> "STU-00042" */
export function formatStudentNumber(number: number) {
  return `STU-${String(number).padStart(5, "0")}`;
}

export type StudentLookup =
  | { kind: "number"; number: number }
  | { kind: "phone"; phone: string }
  | { kind: "name"; text: string };

/**
 * Works out what a search box query means. "STU-00042", "stu42" and a short
 * number like "42" are student IDs. Six or more digits is a phone number, and
 * what comes back is the tail of it, so the same student is found whether the
 * number is typed as 0611111111, 611111111 or +252 61 1111111. Anything else
 * is part of a name.
 */
export function parseStudentLookup(query: string): StudentLookup {
  const idMatch = STUDENT_NUMBER.exec(query) ?? SHORT_NUMBER.exec(query);
  if (idMatch) return { kind: "number", number: Number(idMatch[1]) };

  const trimmed = query.trim();
  if (PHONE.test(trimmed)) {
    const phone = phoneSearch(trimmed);
    if (phone.length >= 6) return { kind: "phone", phone };
  }

  return { kind: "name", text: trimmed };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Fees are in US dollars. */
export function formatMoney(value: string | number) {
  return usd.format(Number(value));
}

export function formatMonths(months: number) {
  return months === 1 ? "1 month" : `${months} months`;
}
