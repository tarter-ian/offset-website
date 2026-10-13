"use client";

import { type ReactNode, useEffect, useState } from "react";
import { canInstallExtension } from "@/lib/extension";

/**
 * Shows its children only where the extension can be installed. Phones never mention
 * the extension (Ian, 2026-10-13), so the server renders nothing and a computer fills it in.
 */
export function ComputerOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [computer, setComputer] = useState(false);
  useEffect(() => setComputer(canInstallExtension()), []);
  return <>{computer ? children : fallback}</>;
}
