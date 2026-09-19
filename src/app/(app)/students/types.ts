// Plain shapes handed from server pages to the student forms. Kept apart from
// queries.ts, which is server-only, so client components can import them.

/** A skill as offered at one branch, ready to show in a picker. */
export type BranchSkillOption = {
  id: string;
  branchId: string;
  branchName: string;
  skillId: string;
  skillName: string;
  categoryName: string;
  teacherName: string;
  classroomName: string;
  durationMonths: number;
  registrationFee: string;
  monthlyFee: string;
};

export type StudentFormValues = {
  fullName: string;
  sex: "MALE" | "FEMALE" | "";
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
