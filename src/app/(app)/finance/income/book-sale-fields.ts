// The sell books form has a row per title, each with fields of its own, so a
// row's book and its copies stay together however many rows there are and
// whichever of them are left empty. Shared by the form and the action.

/** Repeats once per row, holding the row's key. */
export const LINE_FIELD = "line";

export function bookField(key: string | number) {
  return `book_${key}`;
}

export function quantityField(key: string | number) {
  return `quantity_${key}`;
}
