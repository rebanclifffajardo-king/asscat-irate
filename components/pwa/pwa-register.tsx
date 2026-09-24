"use client";

import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";

/** Registers the service worker and captures install events on every page. Renders nothing. */
export function PwaRegister() {
  useEffect(() => { startPwa(); }, []);
  return null;
}
