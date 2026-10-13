"use client";

import { useEffect, useState } from "react";
import { fetchAccount } from "@/lib/accountClient";
import { canInstallExtension, forgetExtensionData } from "@/lib/extension";

// Everything the site keeps in this browser. Add new keys here when the site starts saving more.
const BROWSER_KEYS = ["offset:plan:v2", "offset:answers", "offset:checkout:v1", "offset:gift:v1", "offset:list:v1", "offset:topup:v1"];

/** A button to clear what this browser saved. */
export function DataControls() {
  const [cleared, setCleared] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  // Phones never mention the extension (Ian, 2026-10-13).
  const [computer, setComputer] = useState(false);
  useEffect(() => {
    setComputer(canInstallExtension());
    fetchAccount().then((a) => setSignedIn(a.signedIn));
  }, []);
  const ext = computer ? " and the counts the extension keeps" : "";

  async function clearBrowser() {
    try {
      for (const k of BROWSER_KEYS) localStorage.removeItem(k);
    } catch {
      // Storage blocked: nothing was saved to begin with.
    }
    // The extension's per-chat counts too, if it's installed.
    await forgetExtensionData();
    setConfirming(false);
    setCleared(true);
  }

  return (
    <div className="grid gap-6 sm:max-w-md">
      <div className="border-2 border-rule p-4">
        <p className="font-display text-lg font-bold">Clear this browser</p>
        <p className="mt-1 text-sm text-muted">
          Removes your plan, your answers, any gift in progress and your link to change a public listing from this device{ext}. The page
          starts fresh.{" "}
          {signedIn
            ? "Your account keeps what you've offset, so signing in again brings it back."
            : "It also removes your record of what you've offset, since you're not signed in. Your gifts and their receipts aren't affected."}
        </p>
        {confirming ? (
          <div className="mt-3" role="alertdialog" aria-labelledby="clear-confirm">
            <p id="clear-confirm" className="text-sm font-semibold">
              Clear your plan{signedIn ? "" : ", your record"}, answers{computer ? " and the extension's counts" : ""}? This can&apos;t be undone.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearBrowser}
                autoFocus
                className="min-h-11 rounded-md border-2 border-foreground bg-foreground px-4 font-semibold text-background hover:opacity-90"
              >
                Yes, clear it
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCleared(false);
              setConfirming(true);
            }}
            className="mt-3 min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
          >
            {cleared ? "Cleared" : "Clear what's saved here"}
          </button>
        )}
      </div>
    </div>
  );
}
