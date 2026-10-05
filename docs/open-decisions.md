# Open decisions

Questions we haven't answered yet, and the code work waiting on them. Move a
decision to "Decided" when it's settled, and write the rule into CONTEXT.md or
an ADR if it changes how the system behaves.

Last updated 5 October 2026.

## Open

### 1. Deleting a student who only paid a registration fee

Today a student with no monthly fee paid can be deleted, even if they paid a
registration fee. Deleting takes that fee out of the books for the day it was
paid, and the income for that day changes.

- **Allow it (as now).** Simple. The admin can still clean up a duplicate in
  one step.
- **Block it.** The admin has to remove the registration-fee payment first, on
  the Income screen, and then delete the student. Two deliberate steps, and
  the change to the books is visible. This is the same idea as the monthly fee
  rule.

Leaning: block it. Not decided.

### 2. Switching a teacher from Fixed to Percentage

A percentage teacher's unpaid share is everything earned minus everything paid,
and every salary already paid to them counts, including salaries paid while
they were on a fixed pay. Demo Teacher 1's $200 September salary would give
them an unpaid share of -$200.00 the moment they moved to a percentage. With
payouts now limited to the unpaid share, they couldn't be paid again until
their earnings covered it.

Options, not decided:

- Don't count salaries paid before the switch against the unpaid share.
- Warn the admin before the switch that past salaries will count.
- Leave it, and show a negative share as "Overpaid $4.00" with the top card
  counting only what is really still to pay.

### 3. Should branches manage more of their own money?

Branch staff take payments and see their own branch's income and fees owed.
Only the admin records expenses, pays teachers and writes budgets. Options:
keep it, let a branch record its own non-salary expenses, or let a branch see
its own budget read-only. Not decided. The full picture is in
`docs/branch-finances.md`.

### 4. Photos without Cloudinary

The idea is to drop Cloudinary. Staff could show their Google profile
picture, which Google hosts, so we'd store nothing. But Cloudinary only holds
student photos, and students have no Google account. Options for them: keep
Cloudinary for student photos only, drop student photos (initials instead), or
move them to Vercel Blob. Parked on 24 Sep 2026.

### 5. Who may settle a registration fee for less?

On 4 Oct 2026 the Record payment dialog gained an amount box, so a student who
can't pay the whole registration fee can pay less, and the smaller amount
settles it. Branch staff can do this, the same as they already can for a
discounted month. But only the admin can *lower* a fee (Change fee), so staff
can now reach the same result without the admin.

- **Leave it (as now).** Matches monthly fees. Staff at the branch know who
  couldn't pay, and the Income screen shows every amount.
- **Admin lowers the fee first.** Staff could then only record the new fee in
  full, and the admin sees every discount. Slower when a branch is busy.

Not decided. The change is in `recordRegistrationFee`; the second option would
mean allowing a smaller amount only for admins.

### 6. Book discounts and delivery costs

Two choices made by default when books were built on 5 Oct 2026, to confirm
or change:

- **Staff can sell books for less**, the same as fees: the amount starts at
  what the books come to and can be lowered, never raised. Income shows every
  amount. The other way is to make book prices exact, so only the admin
  could give a discount (by changing the branch's price). Same question as
  number 5, for books.
- **A delivery costs nothing in the app.** Add copies only counts copies; what
  the college paid for them is recorded on Expenses by the admin, as now.
  Recording a cost with each delivery would mean branch staff writing
  expenses, which number 3 hasn't decided.

## Still to do (no decision needed)

**Books, before it goes live.** Built and tried in the browser on 5 Oct
2026: the book list, each branch's price and copies, deliveries and fixed
counts with their history, and Sell books on Income, Books and the student's
page. Tried: a price of 0 refused; a book added to Main Branch at $4.50 against
a $5 default; 20 copies delivered, then the count fixed to 18 ("Two copies
damaged"), with the same count and a missing reason refused; a two-title sale
($9 + $3) whose amount followed the books as they were added, more copies than
the shelf held refused ("Only 10 copies left") and more than the total refused,
then recorded at $11 for STU-00001 ("3 books sold for $11.00 instead of
$12.00"); a sale in shillings from the student's page (54,000 SLSH at 12,000);
removing that receipt put the copy back; as abdaal staff, only their own
branch's shelf, Add copies, a sale with no branch picker, another branch's book
refused by the server and its page Not found. Every shelf's count matched its
deliveries and fixes less its sales afterwards. The same day the Student
box in Sell books and Record income became a search by name, ID or phone,
tried in the browser: "demo" listing the five demo students, `3` and
`3333333` both finding STU-00003, a pick by click and by arrow keys and
Enter, a sale recorded for the picked student (receipt 239), a name typed
without picking refused, and abdaal staff finding only their branch's
students by name but STU-00001 by ID. Committed on local `main`
(`038ebc0` to `6256ffe`), not pushed. Production needs the
`20261005090000_books` migration applied *before* the push, after a backup, or
the Income screen and the student pages break. Then the admin adds the books,
adds each to its branches and records the copies on each shelf.

**Two currencies, before it goes live.** Built on 29 Sep 2026 and tried in
the browser the same day: no rate refuses shillings; setting the rate (8,550,
then 9,000); walk-in income, a monthly fee (the box switches to the shilling
price), a registration fee paid now and one paid later, and an expense, all in
shillings; a percentage share in shillings rounded to the shilling; paying
more than a teacher's unpaid share in either currency refused; a fixed salary
in shillings with the currency locked, dollars refused by the server, and a
second payment for the month refused; an old shilling expense edited after a
rate change keeping its rate; the currency filter; staff at abdaal recording
shillings and blocked from Settings; every screen showing the same combined
total at today's rate (checked at 12,000), with each receipt still at its own
day's rate. Production needs the `20260929090000_two_currencies` and
`20260929130000_dollar_values` migrations applied, in that order and after a
backup, *before* the push, or every money screen breaks. Then the admin sets
the exchange rate in Settings, because nothing can be taken in shillings
until they do. The system guide and the Expenses and Monthly budget guides
describe both currencies now; the training slides and their screenshots
still show dollars only.

**Editable expense categories, before it goes live.** Built and tried in
Chrome on 25 Sep 2026: adding, a duplicate name refused, renaming,
recording an expense in the new category, deactivating it (gone from Record
expense, still in the reports and the filter, an old expense keeps it when
edited, a new one refused by the server), deleting it once nothing used it,
a budget plan keeping a deactivated category's amount, and the teacher pay
limit still refusing a second salary. Not committed yet. Production needs
the `20260925120000_expense_categories` migration applied *before* the push,
or every money screen breaks. `pnpm db:deploy` is blocked on this machine,
so it goes in by hand, after a backup.

**Finish the switch to Google sign-in.** Built on 24 Sep 2026: the Google
button next to the password form, a Gmail field on Edit staff, new accounts
with no password, and a seed that makes the first admin without one. Tried
locally: the button reaches Google with the right return address, a new
account gets no password, and changing an email removes the Google link and
logs the person out. On 25 Sep 2026 a real Google sign-in worked locally for
the seeded Gmail admin, which linked Google to the account with its tokens
encrypted, and a Google account with no staff account was refused
(`signup_disabled`, no user created). A security review the same day found
that Better Auth's ID-token sign-in ignored `disableSignUp`, which would have
let anyone with a Google account make a staff account. Fixed before any of
it was committed: that sign-in is off, and a hook refuses any user not made
through the admin's create-user. The rest, in this order:

1. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel (production),
   and add `https://hormuud-academy.vercel.app/api/auth/callback/google` to
   the Google client's redirect URIs. Then deploy.
2. The admin opens each staff account, puts in that person's Gmail and saves,
   their own account first. Saving marks the email verified, which Google
   sign-in needs, so an address that's already right still needs a save.
3. Everyone signs in with Google once. The admin checks their own works
   before anyone else's. Staff accounts then show "Google or password".
4. Only then remove the passwords: delete the `credential` rows in `account`
   for staff and admins, take the password form off the login page, and remove
   New password and `resetStaffPassword`. Password sign-in itself stays on in
   Better Auth for the student portal. `prisma/demo.ts` still gives its staff
   account a password.
5. Take `SEED_ADMIN_PASSWORD` out of your own `.env`. Keep it until step 4:
   it may be the only note of `admin@college.local`'s password, locally and
   in production.

**Per-branch skill pricing and duration** was built and tried in the browser
on 21 Sep 2026: the admin lowered a branch's fees, a new enrollment there
copied the lower price, the students already there kept theirs, and adding a
skill to a branch starts from its defaults. Committed on local `main`
(`628c55a` to `c29e0df`), not pushed. Production needs the
`20260921180000_branch_skill_pricing` migration.

The five rules built on 21 Sep 2026 (fee months, refunds, deleting a
student, teacher payouts, the teacher form) were all tried in the browser the
same day and behaved as decided. A branch-staff pass (as kadar, abdaal branch)
also passed: scoped lists, blocked admin pages, registering a student with the
registration fee paid, a monthly fee and a books sale. Not covered as staff:
adding a skill to an existing student, and finishing or dropping a skill.

**Class times, live except for their hours.** Built, committed and pushed on
3 Oct 2026: class times on each skill's page with the clash checks, picking a
class time when registering a student or adding a skill, and a percentage
teacher's share coming from the class time's teacher. It began with a
Shifts page too, dropped the same day (below). Tried in
the browser the same day, after the migration ran locally without asking
for another: the migration made one class time per branch skill and put
all 17 enrollments in them; shifts added, a backwards one and an
overlapping one refused; setting the time on a carried-over class time; a
second Computer Basics class time; a room clash, a teacher clash, a
student clash (naming the student and "2 more") and a teacher clash across
branches through Change hours all refused; deactivating a shift in use
refused; Add skill with two class times (picker, "Pick a class time",
saved) and a clashing one refused; the registration picker asking for a
class time; the Classes, Shifts and Teachers lists. A monthly fee earns the
share for the class time's teacher: with Computer Basics' morning class time
given to Demo Teacher 2 (30%), October's $20 from a student in it earned
Demo Teacher 2 $6.00 (PAY-00170), and September's from a student in the
afternoon class time, under fixed-salary Demo Teacher 1, earned nobody a
share (PAY-00171).

The same day the fixed shifts went: each class time now types its own start
and end, so a two-hour class and one-hour classes can share an afternoon.
The `20261003120000_class_time_hours` migration copies each class time's
hours from its shift and drops the shifts. Tried in the browser after it ran
locally without asking for another: every class time kept its hours; a
backwards time refused; Room 1 on Mondays holding Graphic Design 4–5 pm,
Tailoring 5–6 pm and Tailoring 6–8 pm, with Demo Teacher 2 teaching the
first two back to back; a 4:30–5:30 pm class in Room 1 refused as a clash;
the Classes page listing them in clock order; /shifts gone.

Then the rest of it, the same day: moving a student to another class time
from their page, and each class's week, opened from its name on the Classes
page. Tried in the browser: Demo Student Two moved from Computer Basics 8–10
am to 4–6 pm with fees and dates unchanged; moving Graphic Design into
Monday 4–5 pm refused as a clash with that; another skill's class time
forced into the form refused; Set active on a dropped skill refused when
its class time clashed with one taken up since, and allowed once it didn't;
the Class time deactivated badge; Room 1's Monday 4–5, 5–6 and 6–8 pm back
to back, the Computer Lab's free 10 am–4 pm and a class with no hours listed
underneath, on a wide screen and a phone; abdaal branch staff opening their
own Room A and getting Not found for Main Branch's Room 1.

Both migrations, `20261003090000_class_times` and
`20261003120000_class_time_hours`, were applied the same day to both of the
user's Neon databases, `ep-square-silence` and `ep-polished-paper` (the first
run hit the wrong one by accident, because a `DIRECT_URL` left in the shell
overrode `.env`), and main was pushed: the deploy was ready in under a
minute.

Still to do: the admin types the hours and days on every class time the
migration made, which show "Time not set" until then. Students can join them
meanwhile, but the app can't check them for clashes. The steps are in the
system guide, under "Setting the hours on class times that say Time not
set". Also still to do: reset the Neon database password, which was pasted
into chat twice.

## Decided

- **Books: one list, a price and a shelf per branch.** Asked on 5 Oct 2026
  ("how am I going to sell a book to a student?") and built the same day; see
  "Still to do" for going live, and
  [ADR 0008](adr/0008-a-shelf-keeps-its-count.md). (5 Oct 2026)
  - One book list for the college. Each branch that sells a book has its own
    copies, because the copies sit on that branch's shelf.
  - Each branch sets its own price, starting from the book's default, like
    skill fees. Only the admin adds books and sets prices.
  - Branch staff record deliveries (Add copies) and fix the count at their
    own branch, with a reason. The admin can at any branch.
  - One sale can hold several titles, each with its copies, on one receipt.
    Books left Record income: a Books payment is a sale from the shelf now.
  - Removing a sale puts its copies back. Deleting a student keeps the books
    they bought, with no student named.
- **Class times: a class hosts different skills at different times, and a
  skill can run more than once at a branch.** Room 3 can have Graphic Design
  4–6 pm and Tailoring 6–8 pm, and Graphic Design can also run 8–10 am in
  Room 1. Built; see "Still to do" for going live. (3 Oct 2026)
  - A **class time** is one branch skill in one class, from a start time to
    an end time on chosen days, with one teacher: "Graphic Design, Room 3,
    4–6 pm, Sat Mon Wed, Ali". A branch skill can have several. Its fees and
    duration stay on the branch skill, the same at every class time.
  - Each class time types its own hours. Fixed shifts per branch were chosen
    first and built, then dropped the same day: they forced every class at a
    branch into the same blocks, so a one-hour class couldn't sit beside a
    two-hour one.
  - Each class time has its own teacher, who can be the same person for
    several. A percentage teacher earns from the students in their own class
    times.
  - Every enrollment is in one class time. Staff pick it when registering or
    enrolling (it's picked for them when there's only one) and can move a
    student to another class time later without touching fees or payments.
    A branch skill with no class time takes no students.
  - The app refuses a clash, by the clock: two class times in the same class
    at overlapping hours on a shared day, one teacher in two places at once
    (across branches too), or one student in two places at once.
  - No seat counts for now. The Classes page shows each room's timetable and
    how many students each class time has.
  - Going live: every existing branch skill becomes one class time in its
    current class with its current teacher, and its students go into it.
    The admin then sets each one's hours and days. CONTEXT.md gets Class
    time, and the system guide drops "no morning and evening groups" from
    its limits.
- **Two currencies, two ledgers: USD and SLSH.** The client wants Somaliland
  shillings next to dollars. Built on 29 Sep 2026; see "Still to do" for
  going live, and [ADR 0007](adr/0007-two-currencies-two-ledgers.md).
  (29 Sep 2026)
  - Every payment and expense has a USD / SLSH dropdown, USD by default. The
    two are never added together when stored. Shillings are whole numbers.
  - A new admin-only Settings page holds the exchange rate: how many
    shillings one dollar is. Each change records who made it and when.
  - Each SLSH payment and expense saves the rate it was taken at, and its
    dollar value that day with it, like a receipt: that never changes.
  - Every total's combined figure uses today's rate, on every screen,
    budget included: the dashboard shows what the money is worth now, so it
    moves when the rate does. Changed the same day from "the rate each
    payment was taken at", which kept past months still but no longer said
    what the college has.
  - Fees stay priced in dollars. A student can pay one in shillings: the
    amount starts at the fee at today's rate and, like a dollar amount, can be
    lowered for a discount. Whatever is recorded settles the month, and the
    shillings go in the SLSH ledger.
  - A fixed-salary teacher is paid in one currency, set on the teacher. A
    percentage teacher earns their share in whatever currency the student
    paid, so their unpaid share has a USD amount and an SLSH amount.
  - Each dashboard box shows the USD figure, the SLSH figure and a combined
    total in dollars, all in the one box.
  - The monthly budget is still planned in dollars and compared against that
    combined total.
- **"Unpaid share", not "owed", for teachers.** What a percentage teacher has
  earned and the college hasn't handed over yet is their unpaid share, on the
  Teacher pay screens, the pay dialog and its messages. "Owed" read as the
  teacher owing the college, because Fees owed uses the same word for money
  students owe. "Owed" now only ever means a student owing the college.
  (27 Sep 2026)
- **Expense categories are the admin's.** A new page, Money → Expense
  categories (`/finance/expense-categories`), adds, renames, deactivates and
  deletes them, A to Z. A category an expense or a budget plan uses can't be
  deleted, only deactivated; there is no "move its expenses and delete" for
  now. Teacher salary is fully locked: no rename, no deactivate, no delete,
  because teacher pay is recorded in it. Income categories stay fixed.
  (25 Sep 2026)
- **Staff sign in with Google only.** No staff account has a password, the
  admin's included. The admin creates each account with the person's Gmail
  and tells them it's ready; Google proves the address is theirs, so no invite
  email is sent. The first admin comes from the seed, which is also the way
  back in if the only admin loses their Google account. (24 Sep 2026)
- **Skill prices by branch.** Branches in poorer cities need to charge less.
  The skill catalog stays one list for the whole college (name, category), so
  reports and the one-active-enrollment-per-skill rule still work. Each skill
  keeps a default monthly fee, registration fee and duration. Adding the skill
  to a branch copies those defaults onto the branch skill, and from then on
  that branch's values are its own. Only the admin sets them. Enrollments
  already copy the fees and end date when a student joins, so a price change
  never touches students already enrolled. (21 Sep 2026)
- **Fee months.** A skill owes exactly as many monthly fees as it lasts
  months, starting with the month the student joined. Four months joining on
  19 April is April to July. (21 Sep 2026)
- **Teacher payouts.** A teacher is never paid more than they're due, and the
  app refuses it, both when the pay is recorded and when a saved one is edited.
  A percentage teacher can be paid up to their unpaid share. A fixed teacher can
  be paid up to their monthly salary for the month, across every payment for
  it, so a second full salary is refused. A fixed teacher with no salary set
  can't be paid until one is entered. (21 Sep 2026)
- **Refunds.** A refund is recording the payment as removed. It's refused once
  the teacher has been paid for the month the payment was taken in, because
  teachers are paid at the end of the month and the college doesn't take that
  money back. Removing a payment before the teacher is paid takes their share
  out on its own. (21 Sep 2026)
- **Deleting a student.** Never once they've paid a monthly fee. To take them
  out of their classes, drop their skills and they show as Inactive. (21 Sep
  2026)
- **The `financials` branch** was merged into local `main` on 21 Sep 2026 (a
  fast-forward, both at `76fa2e8`). Nothing is pushed. Going live still needs a
  production backup, then `pnpm db:deploy`, then the push, because the build
  does not run migrations.
