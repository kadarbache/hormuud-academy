"use client";

import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    // The browser kept the address of the page that failed, so reloading
    // goes back to it.
    <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
      Try again
    </Button>
  );
}
