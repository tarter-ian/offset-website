import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { AccountNav } from "@/components/Account";
import { FooterMoneyLink } from "@/components/FooterMoneyLink";
import "./globals.css";

// Fraunces, a soft serif, for headings, Public Sans (made for US government
// forms) for reading, and Plex Mono for every dollar and kilowatt-hour.
const head = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-head" });
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
            <div className="flex gap-4 text-sm sm:gap-5">
              <Link href="/method" className="hidden text-muted hover:text-foreground sm:inline">
                How it&apos;s calculated
              </Link>
              <Link href="/different" className="hidden text-muted hover:text-foreground sm:inline">
                What&apos;s different
              </Link>
              <Link href="/promises" className="text-muted hover:text-foreground">
                Promises
              </Link>
              {/* Who's offsetting, the public list, in the header (Ian, 2026-10-13); "List" on phones so it fits beside Sign in. */}
              <Link href="/list" className="text-muted hover:text-foreground">
                <span className="sm:hidden">List</span>
                <span className="hidden sm:inline">Who&apos;s offsetting</span>
              </Link>
              <AccountNav />
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          {/* Trimmed footer (Ian, 2026-10-13): no links the header already shows, except the two it hides on phones. */}
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
            <span>
              <Link href="/promises#who" className="underline hover:text-foreground">
                Made by Ian Tarter
              </Link>
              {" · US only"}
              {/* TEST BRANCH ONLY: says whether the build saw the Pledge partner key, never its value. */}
              {` · Pledge key: ${process.env.NEXT_PUBLIC_PLEDGE_PARTNER_KEY?.trim() ? "found" : "missing"}`}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/method" className="underline hover:text-foreground sm:hidden">
                How it&apos;s calculated
              </Link>
              <Link href="/different" className="underline hover:text-foreground sm:hidden">
                What&apos;s different
              </Link>
              <FooterMoneyLink />
              <Link href="/questions" className="underline hover:text-foreground">
                Questions
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
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
