import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/Account";
import "./globals.css";

// Archivo's narrow, heavy cuts for headings, Public Sans (made for US government
// forms) for reading, and Plex Mono for every dollar and kilowatt-hour.
const head = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-head" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body" });
const figures = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-figures" });

export const metadata: Metadata = {
  title: "My Offset: see what your AI use does, and cover it for life",
  description:
    "Link your ChatGPT, Claude or Gemini account, see the carbon, air pollution and water behind it, and fund charities that cancel it out. Then add anything else in your life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${figures.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        <header className="border-b-2 border-rule">
          <nav className="mx-auto flex max-w-5xl items-baseline justify-between px-4 py-3">
            <Link href="/" className="font-display text-xl font-extrabold tracking-tight [font-stretch:80%]">
              My Offset
            </Link>
            <div className="flex gap-5 text-sm">
              <Link href="/method" className="hidden text-muted hover:text-foreground sm:inline">
                How we calculate
              </Link>
              <Link href="/different" className="hidden text-muted hover:text-foreground sm:inline">
                What&apos;s different
              </Link>
              <Link href="/promises" className="text-muted hover:text-foreground">
                Our promises
              </Link>
              <AccountNav />
              <Link href="/start" className="font-semibold text-accent underline underline-offset-4 hover:text-accent-strong">
                Link accounts
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
            <span>
              Figures come from the EPA, EIA, IEA and published AI energy studies, listed on{" "}
              <Link href="/method" className="underline hover:text-foreground">
                How we calculate
              </Link>
              .
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/different" className="underline hover:text-foreground">
                What&apos;s different
              </Link>
              <Link href="/questions" className="underline hover:text-foreground">
                Questions
              </Link>
              <Link href="/ledger" className="underline hover:text-foreground">
                Where the money goes
              </Link>
              <Link href="/list" className="underline hover:text-foreground">
                Public list
              </Link>
              <Link href="/data" className="underline hover:text-foreground">
                Your data
              </Link>
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="underline hover:text-foreground">
                Terms
              </Link>
              <Link href="/promises#who" className="underline hover:text-foreground">
                Made by Ian Tarter
              </Link>
              <span>US only.</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
