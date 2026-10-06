import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

// Small pieces more than one portal page draws.

export const warning = "border-warning-border bg-warning text-warning-foreground";

export function SkillStatus({ status }: { status: "ACTIVE" | "FINISHED" | "DROPPED" }) {
  if (status === "ACTIVE") return <Badge>Active</Badge>;
  if (status === "FINISHED") return <Badge variant="secondary">Finished</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Dropped
    </Badge>
  );
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * The student's unpaid fees altogether, with a way to My fees unless they're
 * on it. The portal says "unpaid", never "owe": it's written for students.
 */
export function UnpaidNotice({ amount, linkToFees }: { amount: string; linkToFees?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm ${warning}`}
    >
      <p>
        You have <span className="font-semibold tabular-nums">{formatMoney(amount)}</span> in
        unpaid fees. Pay at your branch.
      </p>
      {linkToFees && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/fees">
            See my fees
            <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}
