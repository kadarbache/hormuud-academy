# Open decisions

Questions we haven't answered yet, and the code work waiting on them. Move a
decision to "Decided" when it's settled, and write the rule into CONTEXT.md or
an ADR if it changes how the system behaves.

Last updated 24 September 2026.

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

A percentage teacher's balance is everything earned minus everything paid, and
every salary already paid to them counts, including salaries paid while they
were on a fixed pay. Demo Teacher 1's $200 September salary would make them
"owed -$200.00" the moment they moved to a percentage. With payouts now limited
to what's owed, they couldn't be paid again until their earnings covered it.

Options, not decided:

- Don't count salaries paid before the switch against the percentage balance.
- Warn the admin before the switch that past salaries will count.
- Leave it, and show any negative balance as "Overpaid $4.00" with the top card
  counting only what is really owed.

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

## Still to do (no decision needed)

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

## Decided

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
  A percentage teacher can be paid up to what they're owed. A fixed teacher can
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
