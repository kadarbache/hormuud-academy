# College System

Runs one college with several branches: the skills it teaches, the students it registers, and which skills each student takes at which branch.

## Language

### The college

**College**:
The one organisation this system runs. There is no second college.
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
Something the college teaches, like Graphic Design or Tailoring, with a duration in months and a monthly fee. One catalog serves every branch.
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

**Registration**:
Adding a new student to the college, along with the first skills they take. Happens once per student.
_Avoid_: Admission, sign-up

**Enrollment**:
One student taking one branch skill from a start date, keeping the monthly fee from the day they joined. Its status is Active, Finished or Dropped.
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
A student with at least one Active enrollment, at any branch. Every other student is an Inactive student. Nobody sets this by hand.

**Deactivate**:
Take a branch, category, skill, branch skill, teacher, class or staff account out of new use while keeping its history. Deleting is only for records nothing uses yet.
_Avoid_: Archive, disable
