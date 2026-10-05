# A branch's shelf keeps its own count of copies

Books are sold from a list the whole college shares, but each branch sets its own price and keeps its own copies, the same split as a skill and its branch skills. Stock is counted per branch because the copies sit on one branch's shelf: a college-wide number could say ten in stock while the branch at the counter has none.

Money totals in this app are never stored. They are added up from the payments and expenses every time, so they can't drift from the ledger. Stock breaks that rule on purpose: each branch book keeps its count in a column, and the database refuses a count below zero. A sale takes its copies off in the same transaction that records the payment, with an update that only succeeds while enough copies are left, so two people at the counter can't both sell the last copy. Adding up the history on every sale couldn't promise that without locking rows by hand.

The count still has to agree with a history, so nothing about it is a mystery. Every delivery and every count fixed by hand is kept as a stock change, with who made it, why, and what the count was afterwards, and every sale keeps a line per title with its copies and the price that day. The count is always the stock changes added up, less the copies on the sales. Removing a sale puts its copies back in the same transaction, and deleting a student keeps the books they bought as a sale with no student named, because those copies have left the shelf either way.

A sale is a payment in the Books category with lines, not a separate kind of record, so book money lands in every income total, filter and receipt the way fees do. Its amount is what was actually paid, which can be lowered for a discount like a fee, but never raised past what the lines come to.
