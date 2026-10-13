import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "@/components/SignIn";

export const metadata: Metadata = { title: "Sign in | My Offset" };

export default function SignInPage() {
  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <h1 className="border-t-4 border-rule pt-4 text-3xl font-extrabold [font-stretch:85%]">Sign in</h1>
      <p className="mt-3 text-muted">
        Keep what you&apos;ve covered on every device. I email you a code, so there&apos;s no password. Your account holds your email and what you&apos;ve
        covered, never how much you use anything.
      </p>
      <Suspense>
        <SignIn />
      </Suspense>
    </article>
  );
}
