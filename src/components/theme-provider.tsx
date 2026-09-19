"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Puts `class="dark"` on <html> when the chosen theme, or the device's, is dark. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
