"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/** A strip across the top of every screen while the connection is down. */
export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="size-4 shrink-0" />
      No internet. Anything you saved will go through when the connection is back.
    </div>
  );
}
