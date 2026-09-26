# Using expenses

An **expense** is money the college spent: the day it went out, the branch it
was spent for, what it went on, how it was paid and how much. Rent, electricity,
stationery and teacher salaries are all expenses.

Only an admin can see or record them. Branch staff take payments and chase what
their branch is owed, but expenses, teacher pay and budgets never show on their
screens, so a branch can't read what the college pays its rent or its people.

## Contents

- [Finding the screen](#finding-the-screen)
- [Recording an expense](#recording-an-expense)
- [Paying a teacher](#paying-a-teacher)
- [Reading the expenses page](#reading-the-expenses-page)
- [Changing or removing an expense](#changing-or-removing-an-expense)
- [Managing the categories](#managing-the-categories)
- [Where your expenses show up elsewhere](#where-your-expenses-show-up-elsewhere)
- [When the system says no](#when-the-system-says-no)
- [Everyday tasks](#everyday-tasks)

## Finding the screen

In the sidebar, under **Money**, choose **Expenses**. The categories list is
just below it, and also behind the **Categories** button at the top of the
Expenses page.

The page opens on **this month**. Every other money screen opens on today, but
expenses are read a month at a time far more often, so this one starts there.

## Recording an expense

Press **Record expense** at the top right and fill in the dialog.

| Field | What to put in it |
| --- | --- |
| **Spent on** | The category the money went on: Rent, Electricity, Stationery and so on. Only active categories are offered |
| **Amount (USD)** | What was spent, like `300` or `300.50`. It has to be above zero |
| **Paid by** | Cash, ZAAD, eDahab, or Bank / other |
| **Paid on** | The day the money actually went out. It starts on today and can't be in the future |
| **Branch** | The branch the money was spent for. Only active branches are offered, and the box fills itself in when the college has only one |
| **Note** | Anything that helps later, like "September rent". Up to 200 characters |

Pick **Teacher salary** as the category and two more fields appear — the teacher
and the month the pay covers. They're explained under
[Paying a teacher](#paying-a-teacher).

Press **Record expense** to save. The dialog closes and the message tells you
what went in: *"Rent: $300.00 recorded."* If something is wrong, the dialog
stays open with the problem marked on the field itself.

A couple of things worth knowing while you type:

- **The day matters, not when you typed it.** An expense paid on Friday and
  entered on Saturday belongs to Friday, and that's the day it counts on.
- **The branch matters.** It's the branch the money was spent *for*, which is
  what lets you see later what each branch costs to run against what it brings
  in.
- **Record expense is greyed out** when no branch is active, because an expense
  has to name one.

## Paying a teacher

A teacher's pay is an ordinary expense in the **Teacher salary** category, with
the teacher and the month named on it. That's what lets you look back and see
who was paid, how much and for which month, and it's why neither field can be
left blank.

You can record it from three places, and they all open the same dialog:

- **Money → Teacher pay**, the **Pay a teacher** button at the top.
- The **Pay** button on a teacher's row, which fills in the teacher, the month
  and the amount for you.
- A teacher's own page, from the **Pay this teacher** button.

The amount that gets filled in depends on how the teacher is paid. A teacher on
a **percentage** is offered what they've earned and not yet been paid; a teacher
on a **fixed salary** is offered their monthly salary.

### Nobody is paid more than they're due

The amount box is checked before anything is saved:

- A **percentage teacher** can be paid up to what they're owed. Ask for more and
  you get *"Amina is owed $120.00. Pay that or less."* If they're owed nothing
  yet, it says so.
- A **fixed teacher** can be paid up to their monthly salary for the month the
  pay covers, counting everything already paid for that month. So two half
  payments are fine and a second full salary is refused: *"Amina has been paid
  $200.00 of $300.00 for Sept 2026. Pay $100.00 or less."*
- A fixed teacher with **no salary set** can't be paid at all until one is
  entered on the Teachers page.

Editing a salary you already saved is checked the same way, so you can correct
an amount without the old one counting against you.

### One knock-on effect

Teachers are paid at the end of the month. Once a teacher has been paid for a
month, a payment a student made in that month **can't be removed any more** —
the teacher's share of it has already gone out, and the college doesn't take
that money back. If you genuinely have to remove such a payment, remove the
teacher's salary expense first, then the payment, then record the salary again.

## Reading the expenses page

### Choosing what you're looking at

At the top: the period picker — **One day**, **One month** or **Everything** —
and filters for branch, category and teacher. Set what you want and press
**Apply**; **Clear** puts it all back.

The filters travel in the address bar, so a filtered view can be bookmarked or
sent to somebody else and they'll see exactly the same thing.

Two small points:

- The **branch** filter lists closed branches too, because their old expenses
  are still on the books.
- The **category** filter lists deactivated categories, marked **(inactive)**,
  so you can still find what was spent on them.

### The figures

Under the filters, five cards: the **total spent** over the period you picked,
then that same total split by Cash, ZAAD, eDahab and Bank / other.

Below them, the spending **by category**. Every active category gets a row even
when nothing was spent on it, so a zero is visibly a zero. A deactivated
category appears only when money actually went on it in that period.

### The list

Then every expense, newest first, 25 to a page with **Previous** and **Next**
underneath and a count telling you where you are.

Each row shows the date, the category with your note under it, the branch, how
it was paid, the amount, and who recorded it. On a teacher salary the line under
the category shows the teacher and the month instead of the note.

Filter by a teacher and a line appears above the list with a link through to
what that teacher has earned.

## Changing or removing an expense

**Edit** on a row reopens the same dialog with everything filled in, and
everything is checked again when you save. The row keeps the name of whoever
recorded it first.

**Remove** takes the expense back out of the books for good, after a
confirmation. It's meant for something recorded by mistake, not for an expense
that was later refunded — use it and the month's total, the budget comparison
and, for a salary, what that teacher has been paid all change straight away.

## Managing the categories

**Money → Expense categories**, or the **Categories** button on the Expenses
page. The list runs A to Z and shows how many expenses and how many budget plans
use each one, so you can see at a glance what's in use.

- **Add category.** Two categories can't share a name, upper and lower case
  counted as the same.
- **Rename.** The new name shows everywhere at once, on past expenses too.
- **Deactivate.** The category disappears from Record expense and from the
  budget form, but its old expenses keep it and the reports still count them.
  **Activate** brings it back.
- **Delete** only appears while nothing uses the category — no expense, no
  budget plan. After that it can only be deactivated, because removing it would
  change what past months add up to.

**Teacher salary can't be touched.** It's marked **Built in** and has no
buttons: teacher pay is recorded in it, so renaming, deactivating or deleting it
would break the pay screens.

Every database starts with nine categories — Rent, Electricity, Teacher salary,
Staff salary, Internet, Stationery, Transportation, Maintenance and Other
expenses. Add, rename and deactivate from there to suit the college.

## Where your expenses show up elsewhere

| Screen | What it uses them for |
| --- | --- |
| **Dashboard** | The day's spending and net balance, and the month's spending, broken down by category, with the net balance |
| **Monthly budget** | What each branch actually spent that month, next to what it planned to spend, category by category |
| **Teacher pay** | The "paid" side of every figure: what each teacher has been paid in total, what they've been paid for the month, and what they're still owed |

Nothing is ever recorded twice. A salary you enter on the Teacher pay screen is
the same expense you'll find on the Expenses page, counted in the month's
spending like every other cost.

None of these figures is stored anywhere — they're added up from your expenses
each time a screen opens. Record one late and every screen shows it at once.

## When the system says no

| Message | What to do |
| --- | --- |
| *"Enter an amount above zero."* | An expense of zero isn't recorded. Put the real amount in |
| *"The date can't be in the future."* | Record the money on the day it went out, not the day it's due |
| *"Rent has been deactivated. Pick another category."* | Somebody deactivated the category. Choose an active one, or activate that one again |
| *"Pick the teacher being paid." / "Pick the month this pay covers."* | Teacher salary needs both, so the pay can be traced back to a person |
| *"Amina is owed $120.00. Pay that or less."* | The teacher would be overpaid. Pay what's owed, or check whether the earlier payment was right |
| *"Amina has no monthly salary set."* | Set their salary on the Teachers page first |
| *"Teacher salary can't be changed: teacher pay is recorded in it."* | That category is fixed. Nothing to do |
| *"There's already an expense category with this name."* | Pick a different name — the one you typed exists, possibly in different capitals |
| *"Rent is already in use. Deactivate it instead."* | Money has been spent or planned in it. Deactivating hides it from new use and keeps the history |
| *"Amina has already been paid for Sept 2026, so this payment can't be removed."* | Remove the teacher's salary expense for that month first, then the payment |

## Everyday tasks

**Record this month's rent.** Expenses → Record expense → Rent, the amount, how
it was paid, the day, the branch, and "September rent" as the note.

**See what one branch spent last month.** Expenses → set the period to One
month, pick the month, pick the branch, **Apply**. The cards give you the total
and the split by method; the breakdown gives you each category.

**Check what you spend on electricity across the year.** Set the period to
**Everything**, set the category to Electricity, **Apply**.

**Pay a teacher their salary.** Money → Teacher pay → pick the month → **Pay**
on their row. The amount comes filled in; check it and save.

**See everything a teacher has been paid.** Expenses → filter by that teacher,
or open them from Money → Teacher pay for their earnings as well.

**Fix an expense entered wrong.** Find it on the list and press **Edit**. Use
**Remove** only when the expense shouldn't be there at all.

**Add a category you've started spending on.** Expenses → Categories → **Add
category**. It's available on Record expense and in the budget form right away.
