"use client";

import { ENV } from "../config/environment";

let cached: boolean | null = null;

export function isDebugEnabled(): boolean {
  if (cached !== null) return cached;
  // Env flag enables debug globally
  let enabled = !!ENV.DEBUG;
  // Allow URL or localStorage override in the browser
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    if (q.get("debug") === "1" || q.get("debug") === "true") enabled = true;
    const ls = window.localStorage.getItem("av_debug");
    if (ls === "1" || (ls || "").toLowerCase() === "true") enabled = true;
  }
  cached = enabled;
  return enabled;
}

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(`[AV][${scope}]`, ...args);
}

export function enableDebugPersist(enable: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("av_debug", enable ? "1" : "0");
  cached = enable;
}
