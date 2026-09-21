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

## 2. Sign in with Google

Let staff log in with their Google account instead of typing a password. Only
staff log in (the admin and branch staff); students never do.

Leaning (not final): **keep both**. Staff can use Google or their password, and
the admin always keeps a password as a backup.

### Needed before any code

1. **A Google Cloud project** (free) with an **OAuth consent screen**, the
   "Sign in to Hormuud Academy" screen people see.
2. **An OAuth client ID** listing the app's exact web address. Localhost works
   for testing; the real domain has to exist first, so this waits on deploying.
3. **Publish the consent screen.** In "Testing" mode only up to 100 listed test
   users can sign in, and they're logged out every 7 days. Asking only for name
   and email needs no Google review; adding a logo may need a short brand check.

### Cost

Free.

### How it fits the app

- The admin still creates every staff account, with its role and branch.
  Google only replaces the password.
- The staff account's email has to be the person's Google email.
- Sign-up through Google is off, so an unknown Google account is refused.
- Deactivating a staff member still locks them out, Google or not.

### Things to weigh

- **Good:** no passwords to hand out or reset, and Google's security (two-step
  verification) is usually stronger than a password the admin chose.
- **Shared branch computers:** Google stays signed in in the browser. If staff
  share a computer and don't sign out of Google, the next person opens the app
  as them. Separate browser profiles, or signing out, solves it.
- **Personal Gmail:** access is tied to that account. Fine, since the admin
  controls access, but a college Google Workspace would be tidier.

### Still to decide

- Whether to do it at all, and when.
- Keep both login methods (the leaning), or Google only for branch staff.

## Side by side

| | WhatsApp | Google sign-in |
|---|---|---|
| Waiting on others | Meta business verification, template approval | Almost nothing |
| Cost | Per message | Free |
| Needs the app deployed | Yes, for delivery reports | Yes, for the real domain |
| Size of the work | Medium to large | Small |
| Who benefits | Students | Staff |
