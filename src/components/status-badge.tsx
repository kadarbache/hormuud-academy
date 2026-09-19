import { Badge } from "@/components/ui/badge";

/** Active/Inactive for records the admin can switch off: branches, skills, teachers. */
export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
