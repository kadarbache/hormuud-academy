"use client";

import { TriangleAlert } from "lucide-react";
import { FullPageMessage } from "@/components/full-page-message";
import { Button } from "@/components/ui/button";

// Catches what (app)/error.tsx can't: the sidebar layout itself failing, say
// because the database is down, and the login page.
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <FullPageMessage
      icon={TriangleAlert}
      title="Something went wrong"
      action={
        <Button className="w-full" onClick={retry}>
          Try again
        </Button>
      }
    >
      Hormuud Academy couldn&apos;t load. Try again in a moment. If it keeps happening, tell the
      admin
      {/* The digest matches the error in the server logs. */}
      {error.digest ? (
        <>
          {" "}
          and give them this code: <code className="font-mono">{error.digest}</code>.
        </>
      ) : (
        "."
      )}
    </FullPageMessage>
  );
}
