"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">Something went wrong loading this page.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try again. If it keeps happening, tell the admin what you were doing.
      </p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
