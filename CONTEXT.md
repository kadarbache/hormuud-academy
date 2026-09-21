# Hormuud Academy

Runs Hormuud Academy, one college with several branches: the skills it teaches, the students it registers, and which skills each student takes at which branch.

## Language

### The college

**College**:
Hormuud Academy, the one organisation this system runs. There is no second college.
_Avoid_: Tenant, organisation, school

**Branch**:
One location of the college. Classes, teachers and branch staff belong to a branch; the skill catalog and students belong to the whole college.
_Avoid_: Campus, sub-college, site

**Admin**:
A staff account that works across every branch and sets up branches, skills, teachers, classes and staff accounts.
_Avoid_: Head office, super admin, owner

**Branch staff**:
A staff account that works at exactly one branch, registering students and enrolling them in that branch's skills.
_Avoid_: Registrar, receptionist, user

### What the college teaches

**Skill**:
Something the college teaches, like Graphic Design or Tailoring, with a duration in months, a registration fee and a monthly fee. One catalog serves every branch.
_Avoid_: Course, program, subject

**Category**:
A group of skills, like Technology Skills or Hand Skills.
_Avoid_: Type, department

**Branch skill**:
A skill as taught at one branch, with that branch's teacher and class. A skill taught at three branches has three branch skills.
_Avoid_: Offering, section, course run

**Class**:
A room at a branch where a skill is taught, like Room 3. Never a group of students.
_Avoid_: Group, batch, section

**Teacher**:
A person who teaches skills at one or more branches. Not a staff account.
_Avoid_: Instructor, trainer, lecturer

**Monthly fee**:
What a skill costs per month, in US dollars.
_Avoid_: Price, tuition

**Registration fee**:
What a student pays once for each skill they start, on top of the monthly fee, in US dollars. Each skill sets its own, and zero means none. Despite the name it goes with the enrollment, not the registration: two skills mean two registration fees, and taking a skill again means paying again.
_Avoid_: Admission fee, enrollment fee, joining fee

**Unpaid**:
A registration fee above zero with no payment recorded. It stays unpaid until staff record the payment or the admin waives it, whatever the enrollment's status.
_Avoid_: Outstanding, owing, due

**Waive**:
Set one student's registration fee for one skill to zero. Only the admin can waive or lower a fee, and only while it's unpaid.
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
One student taking one branch skill from a start date, keeping the monthly fee and registration fee from the day they joined. Its status is Active, Finished or Dropped.
_Avoid_: Registration, subscription

**Finished**:
The student completed the skill.

**Dropped**:
The student stopped coming before completing the skill.
_Avoid_: Cancelled, withdrawn

**End date**:
An enrollment's start date plus the skill's duration. A guide for staff; it never finishes an enrollment by itself.

**Past end date**:
An Active enrollment whose end date has gone by, waiting for staff to mark it Finished or keep it going.
_Avoid_: Overdue, expired

**Active student**:
A student with at least one Active enrollment, at any branch. Every other student is an Inactive student. Nobody sets this by hand: to take a student out of their classes, drop their skills. A student who has paid even one monthly fee can never be deleted, so dropping is the only way out; deleting is for duplicates and typing mistakes.

**Deactivate**:
Take a branch, category, skill, branch skill, teacher, class or staff account out of new use while keeping its history. Deleting is only for records nothing uses yet.
_Avoid_: Archive, disable

### Money

**Payment**:
Money the college received, recorded once with the day it came in, the branch that took it, what it was for and how it was paid. Registration fees and monthly fees are payments, and so is a book sold over the counter.
_Avoid_: Receipt, transaction, income record

**Payment method**:
How the money changed hands: Cash, ZAAD, eDahab, or Bank / other. ZAAD and eDahab are the mobile money services.
_Avoid_: Channel, mode, wallet

**Income category**:
What a payment was for: Registration fee, Monthly fee, Books, Examination fee or Other income. The first two always belong to one enrollment; the rest are entered on their own.
_Avoid_: Income type, source

**Fee month**:
The month a monthly fee pays for, not the day the money arrived. September stays paid whether it was settled in August or in November. A skill has as many fee months as it lasts months, starting with the month the student joined: four months joining in April is April to July.
_Avoid_: Billing period, cycle

**Monthly fee payment**:
One fee month of one enrollment, paid. A month is paid in full or not at all, the same way a registration fee is; the amount can be lowered for a discount, and whatever is recorded settles that month.
_Avoid_: Instalment, invoice, bill

**Owed**:
A registration fee above zero, or a fee month the enrollment has reached, with no payment against it.
_Avoid_: Arrears, balance, debt, outstanding

**Expense**:
Money the college spent, recorded with the day it went out, the branch it was spent for, and a category. Every expense names a branch, so what each one costs to run can be checked against what it takes in.
_Avoid_: Cost, outgoing, bill

**Expense category**:
What the money went on: Rent, Electricity, Teacher salary, Staff salary, Internet, Stationery, Transportation, Maintenance or Other expenses.
_Avoid_: Expense type, account

**Salary type**:
How a teacher is paid: a Fixed salary every month, or a Percentage of the monthly fees their students pay. Never both.
_Avoid_: Pay type, contract

**Percentage rate**:
The share of every monthly fee a percentage-paid teacher earns, written as a percentage: 30 means 30%.
_Avoid_: Commission, cut

**Teacher share**:
What one monthly fee payment earned one teacher, worked out and kept on the payment when it's recorded. Raising a teacher's rate changes what they earn from then on and never rewrites what they earned before. Teachers are paid at the end of the month, and once one has been paid for a month, a payment taken in that month can't be removed: the college doesn't refund money whose share has already gone to the teacher.
_Avoid_: Commission, accrual

**Owed to a teacher**:
Everything a percentage teacher has earned, minus everything the college has paid them. Nobody sets this by hand.
_Avoid_: Balance, accrued earnings

**Teacher pay**:
An expense in the Teacher salary category naming the teacher and the month it covers: a fixed salary for that month, or a settlement of what a percentage teacher has earned. A teacher is never paid more than they're due: a percentage teacher up to what they're owed, a fixed teacher up to their monthly salary for that month across every payment made for it. The app refuses more, whether it's recorded or edited later.
_Avoid_: Payroll, payout, wages

**Monthly budget**:
One branch's plan for one month: the income it expects and what it means to spend on each expense category. Written before the month is spent, and compared against what actually happened.
_Avoid_: Forecast, target, projection

**Net balance**:
Income minus expenses over a day, a month or a branch. Negative means the college spent more than it took.
_Avoid_: Profit, surplus, bottom line
