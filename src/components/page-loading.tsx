import { Spinner } from "@/components/ui/spinner";

/**
 * What a page shows while it loads, from the loading.tsx files.
 *
 * A loading.tsx only covers moves between the folders directly inside its
 * own, so every folder holding more than one page has one: going from
 * /students to /students/[id] needs students/loading.tsx. Searching and
 * filtering leave the page on screen instead.
 *
 * It fades in after a moment, so a page that loads quickly doesn't flash it.
 */
export function PageLoading() {
  return (
    <div className="flex justify-center py-24 animate-in fade-in fill-mode-both delay-300 duration-300">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
