import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offset: use AI guilt-free, and offset the rest of your life",
  description:
    "Offset your AI use for life, then pick any other part of your life to offset, with donations to vetted charities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Offset
            </Link>
            <div className="flex gap-5 text-sm text-muted">
              <Link href="/method" className="hidden hover:text-foreground sm:inline">
                How we calculate
              </Link>
              <Link href="/promises" className="hover:text-foreground">
                Our promises
              </Link>
              <Link href="/start" className="font-medium text-accent hover:text-accent-strong">
                Get started
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">
            Estimates use public data from the EPA and EIA. Figures are approximate.
          </div>
        </footer>
      </body>
    </html>
  );
}
