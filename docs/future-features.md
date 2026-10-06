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

## Side by side

| | WhatsApp |
|---|---|
| Waiting on others | Meta business verification, template approval |
| Cost | Per message |
| Needs the app deployed | Yes, for delivery reports |
| Size of the work | Medium to large |
| Who benefits | Students |

Google sign-in for staff was on this list until 24 September 2026, when it was
built. How it works is in `docs/system-guide.md`, and the rest of the
switch-over is in `docs/open-decisions.md`.

The student portal was on this list until 6 October 2026, when student logins
and the portal were built. How they work is in `docs/system-guide.md`, and what
is still open about them is in `docs/open-decisions.md`.
