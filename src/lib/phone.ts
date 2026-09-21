/**
 * Phone numbers, kept in one shape.
 *
 * Every number the college holds is a Somali mobile: country code 252, then
 * nine digits. The country code is the same for everyone, so the forms print
 * "+252" beside the box and ask for the nine, written the way people read
 * them out — "61 1111111". Most start with 6, so the box starts there, but
 * the digit can be changed for a number that doesn't.
 *
 * The database keeps digits and nothing else — "252611111111" — because that
 * is the form WhatsApp takes, in a wa.me link and in the Cloud API's `to`
 * field. A number can go from a row to a message without being cleaned up.
 */

export const COUNTRY_CODE = "252";
/** Printed beside the box people type into. */
export const PHONE_PREFIX = `+${COUNTRY_CODE}`;
/** Most Somali mobiles start with this, so a fresh box does too. */
export const DEFAULT_PREFIX = "6";
/** How many digits a person types: 611111111. */
export const NATIONAL_DIGITS = 9;
/** The first two digits are the network's, and are read as their own group. */
const GROUP = 2;

const STORED = new RegExp(`^${COUNTRY_CODE}\\d{${NATIONAL_DIGITS}}$`);

function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * The nine digits of the number, or "" when what was typed isn't one. The box
 * asks for those nine, but people paste whole numbers into it, so
 * "0611111111", "+252 61 1111111" and "00252611111111" are understood too.
 * The extras are only stripped when there are digits to spare, so a national
 * number is never mistaken for a country code or a trunk zero.
 */
export function nationalDigits(value: string) {
  let digits = digitsOf(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(COUNTRY_CODE) && digits.length > NATIONAL_DIGITS) {
    digits = digits.slice(COUNTRY_CODE.length);
  }
  if (digits.startsWith("0") && digits.length > NATIONAL_DIGITS) digits = digits.slice(1);
  // A Somali mobile starts 6, 7 or 9. A leading zero here means the number is
  // short or was mistyped, not that it is a number beginning with nought.
  if (digits.startsWith("0")) return "";
  return digits.length === NATIONAL_DIGITS ? digits : "";
}

/** How the nine digits are written while they're being typed: "61 1111111". */
function groupNational(value: string) {
  const digits = digitsOf(value).slice(0, NATIONAL_DIGITS);
  return digits.length > GROUP ? `${digits.slice(0, GROUP)} ${digits.slice(GROUP)}` : digits;
}

/**
 * What the box shows for whatever has been typed or pasted into it. A whole
 * number pasted in is reduced to its nine digits first, so "0611111111" and
 * "+252 61 1111111" both settle as "61 1111111"; a half-typed number is left
 * as it is so it can be finished.
 */
export function phoneTyped(value: string) {
  return groupNational(nationalDigits(value) || value);
}

/** What goes in the database: "61 1111111" -> "252611111111". Null if it isn't a number. */
export function toStoredPhone(value: string) {
  const national = nationalDigits(value);
  return national ? `${COUNTRY_CODE}${national}` : null;
}

/** What a screen shows: "252611111111" -> "+252 61 1111111". */
export function formatPhone(stored: string | null | undefined) {
  if (!stored) return "";
  // Anything that predates this format, or was typed straight into the
  // database, is shown as it is rather than mangled into a shape it isn't.
  if (!STORED.test(stored)) return stored;
  return `${PHONE_PREFIX} ${groupNational(stored.slice(COUNTRY_CODE.length))}`;
}

/**
 * What a form's box starts with: "252611111111" -> "61 1111111", and "" for a
 * record with no number, which the field fills with the 6 it starts at.
 */
export function phoneEntry(stored: string | null | undefined) {
  const national = stored ? nationalDigits(stored) : "";
  return national ? groupNational(national) : "";
}

/**
 * True when the box holds nothing anybody typed. A fresh box already has the
 * 6 in it, so a phone nobody filled in has to count as empty, or every
 * optional phone field would fail.
 */
export function isBlankEntry(value: string) {
  const digits = digitsOf(value);
  return digits === "" || digits === DEFAULT_PREFIX;
}

/**
 * The digits to match the end of a stored number with, so a search finds a
 * student whether it's typed as 0611111111, 611111111 or +252 61 1111111.
 */
export function phoneSearch(query: string) {
  let digits = digitsOf(query);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(COUNTRY_CODE) && digits.length > NATIONAL_DIGITS) {
    digits = digits.slice(COUNTRY_CODE.length);
  }
  if (digits.startsWith("0") && digits.length > NATIONAL_DIGITS) digits = digits.slice(1);
  return digits;
}
