# Hormuud Academy

Runs Hormuud Academy, one college with several branches: the skills it teaches, the students it registers, which skills each student takes at which branch, and the books each branch sells.

## Language

### The college

**College**:
Hormuud Academy, the one organisation this system runs. There is no second college.
_Avoid_: Tenant, organisation, school

**Branch**:
One location of the college, often in its own city. Classes, teachers and branch staff belong to a branch; the skill catalog and students belong to the whole college. What a skill costs is set per branch, because a branch in a poorer city charges less.
_Avoid_: Campus, sub-college, site

**Admin**:
A staff account that works across every branch and sets up branches, skills, teachers, classes and staff accounts.
_Avoid_: Head office, super admin, owner

**Branch staff**:
A staff account that works at exactly one branch, registering students and enrolling them in that branch's skills.
_Avoid_: Registrar, receptionist, user

### What the college teaches

**Skill**:
Something the college teaches, like Graphic Design or Tailoring. One catalog serves every branch. A skill carries a default duration, registration fee and monthly fee, which a branch starts from when the skill is added to it. Changing a default touches no branch that teaches the skill already.
_Avoid_: Course, program, subject

**Category**:
A group of skills, like Technology Skills or Hand Skills.
_Avoid_: Type, department

**Branch skill**:
A skill as taught at one branch, with that branch's duration, registration fee and monthly fee, the same at every one of its class times. A skill taught at three branches has three branch skills, and each can charge a different amount. Only the admin sets them.
_Avoid_: Offering, section, course run

**Class**:
A room at a branch, like Room 3, holding different skills at different times of the day. Never a group of students.
_Avoid_: Group, batch, section

**Class time**:
One branch skill taught in one class, from a start time to an end time on chosen days, by one teacher, like Graphic Design in Room 3 from 4 to 6 pm on Saturday, Monday and Wednesday. Each sets its own hours, a branch skill can run at several, and no class, teacher or student is ever in two class times at once.
_Avoid_: Shift, group, session, section, batch, slot

**Teacher**:
A person who teaches skills at one or more branches. Not a staff account.
_Avoid_: Instructor, trainer, lecturer

**Monthly fee**:
What a branch skill costs per month, set in US dollars. A student can pay it in shillings at the exchange rate. Zero means the skill is free: it has no fee months, so nothing is ever owed for it.
_Avoid_: Price, tuition

**Registration fee**:
What a student pays once for each skill they start, on top of the monthly fee, set in US dollars. Each branch skill sets its own, and zero means none. Despite the name it goes with the enrollment, not the registration: two skills mean two registration fees, and taking a skill again means paying again. A student who can't pay all of it can pay less: staff record the smaller amount, never more than the fee, and it settles the fee, with no balance kept.
_Avoid_: Admission fee, enrollment fee, joining fee

**Unpaid**:
A registration fee above zero with no payment recorded. It stays unpaid until staff record the payment or the admin waives it, whatever the enrollment's status.
_Avoid_: Outstanding, owing, due

**Waive**:
Set one student's registration fee for one skill to zero. Only the admin can waive or lower a fee, and only while it's unpaid. That changes what the student owes; staff recording a smaller payment doesn't change the fee, it only settles it for less.
_Avoid_: Cancel, exempt

### Students

**Student**:
A person registered with the college. Belongs to the whole college, not to a branch.
_Avoid_: Learner, trainee

**Student ID**:
The number a student is known by, from STU-00001 upward, counted across the whole college and never reused.
_Avoid_: Registration number, admission number

**Home branch**:
The branch where a student registered. The student can still take skills at any branch.
_Avoid_: Owning branch

**Responsible person**:
The person the college contacts about a student, recorded by phone number.
_Avoid_: Guardian, parent

**Phone number**:
A Somali mobile, kept as digits with the country code and nothing else: 252611111111. That is the form WhatsApp takes, so a number is ready to message as it stands. Forms print "+252" in a box of its own and take the nine digits after it, grouped as they are read out (61 1111111); the box starts at 6 because most numbers do, and that digit can be changed. Screens print the whole number back as +252 61 1111111.
_Avoid_: Mobile, contact, msisdn

**Registration**:
Adding a new student to the college, along with the first skills they take. Happens once per student.
_Avoid_: Admission, sign-up

**Enrollment**:
One student taking one branch skill in one of its class times, from a start date, keeping the monthly fee and registration fee from the day they joined; moving to another class time changes neither. Its status is Active, Finished or Dropped.
_Avoid_: Registration, subscription

**Finished**:
The student completed the skill.

**Dropped**:
The student stopped coming before completing the skill.
_Avoid_: Cancelled, withdrawn

**End date**:
An enrollment's start date plus the branch skill's duration, as it was on the day the student joined. A guide for staff; it never finishes an enrollment by itself.

**Past end date**:
An Active enrollment whose end date has gone by, waiting for staff to mark it Finished or keep it going.
_Avoid_: Overdue, expired

**Active student**:
A student with at least one Active enrollment, at any branch. Every other student is an Inactive student. Nobody sets this by hand: to take a student out of their classes, drop their skills. A student who has paid even one monthly fee can never be deleted, so dropping is the only way out; deleting is for duplicates and typing mistakes.

**Deactivate**:
Take a branch, category, expense category, skill, branch skill, teacher, class, class time or staff account out of new use while keeping its history. Deleting is only for records nothing uses yet.
_Avoid_: Archive, disable

### Money

**Currency**:
US dollars (USD) or Somaliland shillings (SLSH). Every payment and expense is in exactly one, and the two are counted apart, like two separate books: no total ever adds a dollar to a shilling. Shillings are whole numbers.
_Avoid_: Money type, denomination

**Exchange rate**:
How many Somaliland shillings one US dollar is, like 8,550. Only the admin sets it, on the Settings page, and every change is kept with who made it and when. Today's rate values every combined figure, and a shilling payment or expense keeps the rate in force when it's recorded.
_Avoid_: Conversion rate, dollar rate, price of the dollar

**Dollar value**:
What one payment or expense was worth in US dollars the day it was recorded, to the cent: its amount for dollars, or its shillings at the rate it was recorded at. Part of the receipt: worked out once and never changed by a new rate. Totals don't add these up.
_Avoid_: USD equivalent, converted amount

**Combined**:
What the two currencies are worth together in US dollars now: the dollars plus the shillings at today's rate. Every total shows the dollars, the shillings and the combined figure, and the combined figure moves when the rate does. The monthly budget is compared against the combined figures.
_Avoid_: Grand total, total in dollars, overall

**Payment**:
Money the college received, recorded once with the day it came in, the branch that took it, what it was for, how it was paid and its currency. Registration fees and monthly fees are payments, and so is a book sale.
_Avoid_: Receipt, transaction, income record

**Payment method**:
How the money changed hands: Cash, ZAAD, eDahab, or Bank / other. ZAAD and eDahab are the mobile money services.
_Avoid_: Channel, mode, wallet

**Income category**:
What a payment was for: Registration fee, Monthly fee, Books, Examination fee or Other income. The first two always belong to one enrollment, and Books is a book sale; the last two are entered on their own.
_Avoid_: Income type, source

**Fee month**:
The month a monthly fee pays for, not the day the money arrived. September stays paid whether it was settled in August or in November. A skill with a monthly fee has as many fee months as it lasts months, starting with the month the student joined: four months joining in April is April to July. A free skill has none.
_Avoid_: Billing period, cycle

**Monthly fee payment**:
One fee month of one enrollment, paid. A month is settled or not at all, the same way a registration fee is; the amount can be lowered for a discount, and whatever is recorded settles that month, in either currency.
_Avoid_: Instalment, invoice, bill

**Owed**:
A registration fee above zero, or a fee month the enrollment has reached, with no payment against it. Only ever money a student owes the college, never the other way round. Owed amounts are in US dollars, because that's what fees are set in.
_Avoid_: Arrears, balance, debt, outstanding

**Expense**:
Money the college spent, recorded with the day it went out, the branch it was spent for, a category and its currency. Every expense names a branch, so what each one costs to run can be checked against what it takes in.
_Avoid_: Cost, outgoing, bill

**Expense category**:
What the money went on, like Rent or Electricity. The admin keeps the list. Teacher salary is the one entry nobody can rename, deactivate or delete, because teacher pay is recorded in it.
_Avoid_: Expense type, account

**Salary type**:
How a teacher is paid: a Fixed salary every month, set and paid in one currency, or a Percentage of the monthly fees their students pay. Never both.
_Avoid_: Pay type, contract

**Percentage rate**:
The share of every monthly fee a percentage-paid teacher earns, written as a percentage: 30 means 30%.
_Avoid_: Commission, cut

**Teacher share**:
What one monthly fee payment earned the teacher of the student's class time, worked out and kept on the payment when it's recorded, in the currency the student paid. Raising a teacher's rate changes what they earn from then on and never rewrites what they earned before. Teachers are paid at the end of the month, and once one has been paid for a month, a payment taken in that month can't be removed: the college doesn't refund money whose share has already gone to the teacher.
_Avoid_: Commission, accrual

**Unpaid share**:
Everything a percentage teacher has earned, minus everything the college has paid them: money the college has still to hand over. Nobody sets this by hand. It's kept per currency, and each currency's part is paid out in that currency.
_Avoid_: Owed, balance, accrued earnings

**Teacher pay**:
An expense in the Teacher salary category naming the teacher and the month it covers: a fixed salary for that month, in the salary's currency, or a settlement of what a percentage teacher has earned. A teacher is never paid more than they're due: a percentage teacher up to their unpaid share in the currency being paid, a fixed teacher up to their monthly salary for that month across every payment made for it. The app refuses more, whether it's recorded or edited later.
_Avoid_: Payroll, payout, wages

**Monthly budget**:
One branch's plan for one month: the income it expects and what it means to spend on each expense category, in US dollars. Written before the month is spent, and compared against the combined figures for what actually happened.
_Avoid_: Forecast, target, projection

**Net balance**:
Income minus expenses over a day, a month or a branch, worked out for each currency and for the combined figures. Negative means the college spent more than it took.
_Avoid_: Profit, surplus, bottom line

### Books

**Book**:
Something the college sells over the counter, like a textbook for a skill. One list serves every branch. A book carries a default price in US dollars, which a branch starts from when the book is added to it. Changing the default touches no branch that sells the book already.
_Avoid_: Product, item, material

**Branch book**:
A book as one branch sells it, with that branch's price and its own stock. Only the admin adds a book to a branch and sets its price, because a branch in a poorer city may charge less. The code calls it `BranchBook`; the screens just name the book and the branch.
_Avoid_: Listing, inventory item

**Stock**:
How many copies of a book one branch has on its shelf, which is what the screens call it: "on the shelf". A sale takes copies off, a delivery puts them on, and a fixed count sets it to what's really there. It never goes below zero, and it always equals every delivery and fixed count, less every copy sold. See [ADR 0008](docs/adr/0008-a-shelf-keeps-its-count.md).
_Avoid_: Inventory, quantity on hand, balance

**Delivery**:
Copies that arrived at a branch, recorded by staff there or by the admin. It adds to the stock and is kept with who recorded it and an optional note.
_Avoid_: Restock, purchase, stock in

**Fixed count**:
Setting a branch's stock to what is really on the shelf, with the reason, like two damaged copies. Staff at the branch or the admin can do it. Kept with the difference, the new count and who made it.
_Avoid_: Adjustment, write-off, correction

**Book sale**:
A payment in the Books category listing one or more books from one branch's shelf, each with how many copies and the branch's price that day. The amount starts at what the books come to and can be lowered for a discount, never raised. Naming a student is optional. Removing the sale puts its copies back on the shelf. A Books payment from before the book list has a note instead of books, and took nothing off any shelf.
_Avoid_: Order, invoice, book payment
