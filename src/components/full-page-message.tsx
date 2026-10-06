import type { LucideIcon } from "lucide-react";

/**
 * A card in the middle of an empty screen, for pages drawn without the
 * sidebar: offline, an address that doesn't exist, or the app failing to load.
 */
export function FullPageMessage({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /** A button under the text. */
  action?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  );
}
