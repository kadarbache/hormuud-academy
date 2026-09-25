# Expense categories are a list the admin keeps, with Teacher salary fixed

The nine expense categories used to be fixed in the database schema. They are now rows the admin adds, renames, deactivates and deletes, because what a college spends money on changes (security, a generator, a new rent) and each new kind of spending shouldn't need a release. Teacher pay is recorded in Teacher salary and the app finds it there, so that one row is fixed: the migration gives it the id `teacher_salary`, and it can't be renamed, deactivated or deleted. A fixed id was chosen over a marker column because nothing else about the row may change anyway, and every teacher-pay query stays a plain comparison.

A category can be deleted only while no expense and no budget plan uses it. After that it can only be deactivated: it leaves the Record expense list and the budget form, and every past month still adds up to what it did. Moving a category's expenses into another one and deleting it (a merge) was rejected for now, because it rewrites past months' totals and budget comparisons.

Income categories stay fixed in code. Registration fees and monthly fees drive the fee rules, so they can't become a list anyone edits.
