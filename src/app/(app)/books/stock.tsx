import { Badge } from "@/components/ui/badge";

/** How many copies a shelf has, flagged when there are none. */
export function Stock({ stock }: { stock: number }) {
  if (stock > 0) return <span className="tabular-nums">{stock}</span>;
  return (
    <Badge variant="outline" className="border-warning-border bg-warning text-warning-foreground">
      Out of stock
    </Badge>
  );
}
