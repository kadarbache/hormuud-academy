import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { FullPageMessage } from "@/components/full-page-message";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };

// The service worker keeps a copy of this page and shows it when a page
// can't load because there's no connection.
export default function OfflinePage() {
  return (
    <FullPageMessage icon={WifiOff} title="You're offline" action={<RetryButton />}>
      Hormuud Academy needs the internet to load students and payments. Check your connection and
      try again.
    </FullPageMessage>
  );
}
