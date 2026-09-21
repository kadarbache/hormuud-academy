# How branches and money fit together

Short answer: each branch collects its own money, but only the admin manages
the finances. A branch does not run its own books.

Written 21 September 2026 from the code as it stands. Where an example uses
numbers, they're from the local demo database on that day.

## The two roles

**Branch staff** work at exactly one branch. They handle money coming in at
the counter.

**The admin** works across every branch. They handle everything else about
money: what goes out, what teachers earn, what each branch planned, and any
correction.

## What branch staff can do

- Record a **registration fee** or a **monthly fee**, only for a skill taught
  at their own branch.
- Record **books, examination fees and other income**, only at their own
  branch.
- See the **Income** screen for their own branch, and nothing from any other.
- See the **Fees owed** screen for their own branch's students, and record the
  payments that clear them.
- See their branch's teachers and classes, read-only.

A staff member can find a student from another branch by exact student ID or
phone, so they can add a skill for that student without registering them
twice. They still only see and act on that student's skills at their own
branch.

## What only the admin can do

- See the **financial dashboard**: income and expenses for a day or a month,
  for every branch or one.
- Record and edit **expenses**, including rent, electricity and salaries.
- Handle **teacher pay**: see what each teacher earned, pay them, and set how
  they're paid (fixed salary or a percentage).
- Write **monthly budgets** for each branch and compare them with what
  happened.
- **Remove a payment** recorded by mistake, and **lower or waive** a
  registration fee.
- See a teacher's **share** on a payment. The column is hidden from branch
  staff.

The pages for expenses, teacher pay, budgets and the dashboard aren't in a
staff member's menu, and the server refuses them if the address is typed in by
hand.

## How every dollar is tied to a branch

Every payment and every expense names a branch. That is what lets the admin
compare what each branch takes in with what it costs to run.

- **A payment's branch.** For a fee, it's the branch that teaches the skill,
  whatever branch the student registered at. For books or an exam fee, it's
  the branch that took the money.
- **An expense's branch.** It's the branch the money was spent for, picked by
  the admin when the expense is recorded. Nothing ties it to where a teacher
  works.
- **A branch's net balance** is its income minus its expenses over a day or a
  month. Negative means it spent more than it took.
- **A monthly budget** is one branch's plan for one month: the income it
  expects and what it means to spend on each expense category. The screen sets
  it beside the real figures, which are counted from the payments and expenses
  each time.

## An example from the demo data

For September 2026 the budget screen shows:

| Branch | Income | Expenses | Net balance |
|---|---|---|---|
| Main Branch | $60.00 | $3.00 | $57.00 |
| Third Branch | $0.00 | $200.00 | -$200.00 |
| abdaal branch | $0.00 | $0.00 | $0.00 |
| The whole college | $60.00 | $203.00 | -$143.00 |

Third Branch shows -$200.00 because Demo Teacher 1's September salary was
recorded against it, although that teacher only works at Main Branch. The
system allows that, since an expense can be booked to any branch. Whoever
records a salary decides which branch carries the cost.

## Situations that cross branches

- **A student registered at one branch takes a skill at another.** The fee goes
  to the branch teaching the skill. The home branch only records where the
  student registered.
- **A teacher works at two branches.** Their pay is one list for the whole
  college, not one per branch. The teacher's page splits what they earned by
  the branch the payments were taken at, so a percentage teacher earns from
  both.
- **A student's page shown to staff.** Staff see only the skills, fees and
  months at their own branch, even if the student takes skills elsewhere.

## Where this is enforced

- `src/lib/access.ts`: `canActAtBranch`. An admin acts anywhere, and branch
  staff only at their own branch. Enrolling a student and recording a payment
  both ask it.
- `src/app/(app)/finance/access.ts`: which payments a person can see, and which
  branch a report covers. Staff always get their own, whatever the address
  says.
- `src/app/(app)/students/access.ts`: which students and enrollments a person
  can see.
- Expenses, teacher pay, budgets and the dashboard each check for an admin at
  the top of the page and in every action.

## Not decided

Should branches manage more of their own money, for example recording their own
expenses or seeing their own budget? Today they can't, on purpose: a branch
shouldn't be able to read what the college pays its people. If that should
change, the choices are:

- **Keep it as it is.** Head office runs all spending and planning.
- **Let a branch record expenses for its own branch only,** such as rent and
  electricity, but not salaries or teacher pay.
- **Let a branch see its own budget, read-only,** so staff know the plan they
  work against.

These can be combined. Nothing here is decided. It's also listed in
`docs/open-decisions.md`.
