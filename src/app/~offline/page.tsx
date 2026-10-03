import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };

// The service worker keeps a copy of this page and shows it when a page
// can't load because there's no connection.
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
          <WifiOff className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">You&apos;re offline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hormuud Academy needs the internet to load students and payments. Check your connection
          and try again.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
