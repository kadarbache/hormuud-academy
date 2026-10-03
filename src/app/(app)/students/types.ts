// Plain shapes handed from server pages to the student forms. Kept apart from
// queries.ts, which is server-only, so client components can import them.

/**
 * The form field that carries the class time picked for one skill on the
 * registration form. Here, not in the form, so the server action reads the
 * same name the form writes.
 */
export const classTimeFieldName = (branchSkillId: string) => `classTime-${branchSkillId}`;

/** One class time a student can join, ready to show in a picker. */
export type ClassTimeOption = {
  id: string;
  /** "4:00–6:00 pm, Sat Mon Wed" */
  when: string;
  classroomName: string;
  teacherName: string;
};

/** A skill as offered at one branch, ready to show in a picker. */
export type BranchSkillOption = {
  id: string;
  branchId: string;
  branchName: string;
  skillId: string;
  skillName: string;
  categoryName: string;
  /** The class times taking students, by the clock. None means nobody can join yet. */
  classTimes: ClassTimeOption[];
  durationMonths: number;
  registrationFee: string;
  monthlyFee: string;
};

export type StudentFormValues = {
  fullName: string;
  sex: "MALE" | "FEMALE" | "";
  /** The nine digits after "+252", the way the box holds them: "61 1111111". */
  phone: string;
  responsiblePhone: string;
  registrationDate: string;
  homeBranchId: string;
  photoUrl: string | null;
};

/** What the duplicate-phone warning shows about an existing student. */
export type PhoneMatch = {
  id: string;
  number: string;
  fullName: string;
  branchName: string;
};
