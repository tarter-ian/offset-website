"use client";

import { useState } from "react";
import { forgetExtensionData } from "@/lib/extension";

// Everything the site keeps in this browser. Add new keys here when the site starts saving more.
const BROWSER_KEYS = ["offset:plan:v2", "offset:answers"];

/** A button to clear what this browser saved. */
export function DataControls() {
  const [cleared, setCleared] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
        <p className="mt-1 text-sm text-muted">Removes your plan and answers from this device, and the counts the extension keeps. The page starts fresh.</p>
        {confirming ? (
          <div className="mt-3" role="alertdialog" aria-labelledby="clear-confirm">
            <p id="clear-confirm" className="text-sm font-semibold">
              Clear your plan, answers and the extension&apos;s counts? This can&apos;t be undone.
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
