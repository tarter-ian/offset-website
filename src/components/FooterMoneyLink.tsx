"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The footer's "Where the money goes", left off the home page, which has its own section on it (Ian, 2026-10-13). */
export function FooterMoneyLink() {
  if (usePathname() === "/") return null;
  return (
    <Link href="/ledger" className="underline hover:text-foreground">
      Where the money goes
    </Link>
  );
}
