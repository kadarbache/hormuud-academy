# Future features

Features we want one day but haven't decided to build. Each one lists what it
needs before any code, what it costs, and what's still to decide. When one is
decided, move its questions into `docs/open-decisions.md` or build it and take
it off this list.

Written 21 September 2026.

## 1. WhatsApp messages to students

Send a student a WhatsApp message when something happens: they register, they
pay a fee, they finish a skill.

Leaning (not final): messages go to the **student only**, sent
**automatically through Meta's WhatsApp Cloud API**.

Phone numbers are already stored the way WhatsApp takes them (`252611111111`),
so that part is ready.

### Needed before any code

1. **A registered business with its papers.** Meta checks the business is real:
   registration documents, a name and address that match. This is usually the
   slow step, days to weeks.
2. **A Meta Business account and a WhatsApp Business account** under it.
3. **A dedicated phone number** that isn't active in the normal WhatsApp or
   WhatsApp Business app. Often a new SIM just for this.
4. **An approved display name**, matching "Hormuud Academy".
5. **The app deployed.** Meta reports "delivered" and "failed" back to a public
   web address.

### How the messages work

- Every message the academy starts is a **template** Meta approves in advance,
  with blanks for the name, amount, month and skill. Free text is only allowed
  within 24 hours of the student writing to us.
- Receipts and confirmations are **utility** messages. Anything that reads like
  promotion becomes **marketing**, which costs more.
- Templates would be in Somali and/or English. Check Somali is in Meta's
  template language list first.

### Cost

- Meta charges **per message delivered**, by category and the recipient's
  country. Check Meta's rate card for Somalia.
- Going straight to Meta's Cloud API avoids a provider's extra fee per message
  (Twilio and the like add their own).
- Rough scale: 300 students, one fee message a month each plus the odd
  registration or finish message, is a few hundred messages a month.

### Rules and limits

- **Consent.** Students must agree to WhatsApp messages: a line on the
  registration form and a record that they agreed.
- **Sending limits.** A new account can message a limited number of different
  people a day. The limit rises with verification and good use.
- **Quality rating.** Blocks and reports lower it and can restrict the account.
  Expected messages like receipts rarely cause this.

### Things specific to us

- The number we store may not be the student's WhatsApp number. A message to a
  number without WhatsApp fails, and the app should show that.
- A message never holds up the action behind it: the payment saves first, the
  message goes after. If WhatsApp is down, the payment is still recorded.
- Every message would be logged (who, what for, sent, delivered or failed) so
  staff can see it and resend a failed one.

### Still to decide

- Which events send a message: registration, each payment, finishing a skill.
  Dropping a skill? A monthly reminder of fees owed?
- The wording of each message, and the language(s).
- Whether staff can see and resend failed messages.

### First step when we're ready

Start Meta Business verification. It has the longest wait, so it can run while
everything else is decided.

## 2. Student portal

Students sign in to see their own exam results and attendance, plus their
fees, their skills and their profile. Talked through on 24 September 2026.

Decided so far:

- **Credentials: Student ID and a password.** The student types `STU-00001`
  and their password. Every student has a Student ID; many have no email and
  the phone is optional, and siblings can share a phone.
- **First password: staff hand over a temporary one.** Staff press "Create
  login" on the student, the app shows a one-time password once, staff give it
  to the student, and the student must choose their own on first sign-in.
- **Forgotten password: back to the branch.** Staff issue a new temporary
  password. Once WhatsApp messages exist (section 1), a code by WhatsApp could
  replace the visit.
- **One login per student, managed from any of their branches.** A student has
  one account however many branches they study at. The admin, and staff at any
  branch the student belongs to, can create it, reset it and switch it off.
  "Belongs to" means the same students staff already see in their list: their
  home branch, or a branch where they take or took a skill.
- **Who can sign in: any student with a login.** Finished and dropped students
  keep read-only access to their own history. Staff can still switch a login
  off by hand.
- **What they see:** exam results, attendance, fees owed and paid, their
  enrollments (skill, branch, class, teacher, end date), and their profile,
  read-only. Changes to a profile still go through staff.
- **No parent access** for now.

### Needed before any code

1. **Exams and attendance themselves.** Neither exists yet. The portal can
   ship earlier with fees, skills and profile, since that data is already
   there.
2. **Strict roles.** `requireUser` in `src/lib/session.ts` treats every role
   that isn't `admin` as `staff`. A `student` role added without fixing that
   would open the whole staff app for their branch. Unknown roles must get
   nothing, and every staff page must refuse a student.

### How it fits the app

- **One login system.** A student account is a Better Auth `User` with role
  `student` and a one-to-one link to its `Student` row. Every portal query is
  scoped to that one student, never taken from the URL.
- **Better Auth's username plugin** signs students in by Student ID. Better
  Auth still wants an email per user, so a student gets a placeholder address
  that is never mailed.
- **Creating a student login has to go through `/admin/create-user`.** A
  hook in `src/lib/auth.ts` refuses to create a user any other way. If staff
  create logins through something else, that path has to be added to the hook
  on purpose.
- **Its own area,** something like `/portal`, with its own layout, built for a
  phone first. Staff and students are sent to their own side after sign-in.
- **Sign-in limits per account.** Today's limit is 5 tries a minute per IP.
  A class on the branch Wi-Fi shares one IP, so a few typos would lock
  everyone out. Students need a limit per Student ID.
- **Must change password** is a flag on the account, set whenever staff issue
  a temporary one, and cleared when the student picks their own.
- Every "create login" and "reset password" is recorded: which staff member,
  at which branch, when. Staff at several branches can reset the same login,
  so the record shows who did it.

### Still to decide

- Rules for a student's own password (at least 8 characters, like the old
  staff passwords?).
- Whether Google sign-in stays staff-only. Leaning yes: students use their
  Student ID. Either way, Google must refuse a student account even if its
  email matches a Google account.
- How long a student stays signed in on their phone.
- Whether the portal is in English, Somali, or both.
- Whether students see exam results as soon as they're entered, or only once
  staff publish them.
- Whether they see which fee months are unpaid, and whether that should hold
  back anything (results, a certificate).

## Side by side

| | WhatsApp | Student portal |
|---|---|---|
| Waiting on others | Meta business verification, template approval | Exams and attendance being built |
| Cost | Per message | Free |
| Needs the app deployed | Yes, for delivery reports | Already deployed |
| Size of the work | Medium to large | Medium, on top of exams and attendance |
| Who benefits | Students | Students |

Google sign-in for staff was on this list until 24 September 2026, when it was
built. How it works is in `docs/system-guide.md`, and the rest of the
switch-over is in `docs/open-decisions.md`.
