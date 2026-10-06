"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import RootError from "./error";

// globals.css reads the font from this variable, which the root layout
// normally sets.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Shown when the root layout itself fails. It replaces that layout, so it
// brings its own <html>, <body>, styles and font. It's always light: the
// theme switch lives in the layout that failed.
export default function GlobalError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className={`h-full antialiased font-sans ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <title>Something went wrong · Hormuud Academy</title>
        <RootError {...props} />
      </body>
    </html>
  );
}
