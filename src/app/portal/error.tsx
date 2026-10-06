"use client";

import { TriangleAlert } from "lucide-react";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <PageMessage
      icon={TriangleAlert}
      title="Something went wrong loading this page"
      action={
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      }
    >
      Try again in a moment. If it keeps happening, tell your branch
      {/* The digest matches the error in the server logs. */}
      {error.digest ? (
        <>
          {" "}
          and give them this code: <code className="font-mono">{error.digest}</code>.
        </>
      ) : (
        "."
      )}
    </PageMessage>
  );
}
