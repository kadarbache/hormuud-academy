import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { requireStudent } from "@/lib/session";
import { attendanceRate, formatCounts, formatRate } from "../../(app)/attendance/labels";
import { marksByEnrollment } from "../../(app)/attendance/queries";
import { SkillStatus } from "../parts";
import { getPortalSkills } from "../queries";

export const metadata: Metadata = { title: "Attendance" };

/** The student's rate in each skill. Each one opens the days it was counted from. */
export default async function PortalAttendancePage() {
  const user = await requireStudent();
  const skills = await getPortalSkills(user.studentId);
  const attendance = await marksByEnrollment(skills.map((skill) => skill.id));

  return (
    <>
      <PageHeader
        title="Attendance"
        description="How often you came to each skill. Late counts as present; Excused counts neither way."
      />

      {skills.length === 0 ? (
        <EmptyRow message="You aren't taking any skills yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((enrollment) => {
            const counts = attendance.get(enrollment.id);
            const rate = counts ? attendanceRate(counts) : null;
            return (
              <Link
                key={enrollment.id}
                href={`/portal/attendance/${enrollment.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{enrollment.skill.name}</span>
                    <SkillStatus status={enrollment.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {enrollment.branchSkill.branch.name}
                    {counts && ` · ${formatCounts(counts)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {counts ? (
                    <span className="text-2xl font-semibold tabular-nums">
                      {rate === null ? "—" : formatRate(rate)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not taken yet</span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
