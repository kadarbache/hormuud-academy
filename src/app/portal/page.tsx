import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyRow } from "@/components/status-badge";
import { formatSlot } from "@/lib/class-times";
import { collegeToday, formatDate } from "@/lib/dates";
import { requireStudent } from "@/lib/session";
import { attendanceRate, formatCounts, formatRate } from "../(app)/attendance/labels";
import { marksByEnrollment } from "../(app)/attendance/queries";
import { feeSchedule } from "../(app)/students/fee-schedule";
import { PORTAL_SHOWS_FEES } from "./fees-switch";
import { Detail, SkillStatus, UnpaidNotice } from "./parts";
import { getPortalFees, getPortalSkills } from "./queries";

export const metadata: Metadata = { title: "My skills" };

/** Where a student lands: every skill they take or took, at every branch. */
export default async function MySkillsPage() {
  const user = await requireStudent();
  const [skills, fees] = await Promise.all([
    getPortalSkills(user.studentId),
    // With fees switched off there's nothing to add up, so no unpaid notice.
    PORTAL_SHOWS_FEES ? getPortalFees(user.studentId) : [],
  ]);
  const attendance = await marksByEnrollment(skills.map((skill) => skill.id));
  const { owedAltogether } = feeSchedule(fees, collegeToday());

  return (
    <>
      <PageHeader title="My skills" description="Every skill you take or took, at every branch." />

      {Number(owedAltogether) > 0 && <UnpaidNotice amount={owedAltogether} linkToFees />}

      {skills.length === 0 ? (
        <EmptyRow message="You aren't taking any skills yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {skills.map((enrollment) => {
            const counts = attendance.get(enrollment.id);
            const rate = counts ? attendanceRate(counts) : null;
            const { classTime } = enrollment;
            return (
              <Card key={enrollment.id} className="gap-3">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{enrollment.skill.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {enrollment.branchSkill.branch.name}
                      </p>
                    </div>
                    <SkillStatus status={enrollment.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3">
                    <Detail label="Class time">{formatSlot(classTime)}</Detail>
                    <Detail label="Class">{classTime.classroom.name}</Detail>
                    <Detail label="Teacher">{classTime.teacher.name}</Detail>
                    <Detail label="Dates">
                      {formatDate(enrollment.startDate)} to {formatDate(enrollment.endDate)}
                    </Detail>
                  </dl>
                  <Link
                    href={`/portal/attendance/${enrollment.id}`}
                    className="mt-4 flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div>
                      <div className="text-xs text-muted-foreground">Attendance</div>
                      {counts ? (
                        <div className="text-sm">
                          <span className="font-medium tabular-nums">
                            {rate === null ? "—" : formatRate(rate)}
                          </span>{" "}
                          <span className="text-muted-foreground">{formatCounts(counts)}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not taken yet</div>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
