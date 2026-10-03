import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Hormuud Academy",
  title: { default: "Hormuud Academy", template: "%s · Hormuud Academy" },
  description: "Student registration and skills for every branch of Hormuud Academy.",
  // Opens full screen when added to an iPhone's home screen.
  appleWebApp: { capable: true, title: "Hormuud", statusBarStyle: "default" },
  // Stops iOS turning phone numbers in tables into call links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // next-themes sets the theme class before React hydrates.
      suppressHydrationWarning
      className={cn("h-full antialiased font-sans", inter.variable, geistMono.variable)}
    >
      <body className="min-h-full flex flex-col">
        {/* No service worker in development, where its cache would serve stale code.
            Never cache visited pages or reload on reconnect: pages hold student
            records, and a reload would throw away a half-filled form. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="top-center" />
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
