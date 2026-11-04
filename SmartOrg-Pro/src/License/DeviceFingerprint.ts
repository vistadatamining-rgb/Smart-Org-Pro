"use strict";

/**
 * Computes a stable code from OS/hardware-level signals that stay the SAME for the same
 * physical device, no matter how many report instances or visual copies read it. Re-derived
 * fresh every call — no persistence needed, so it can't drift between report instances the way
 * an earlier random-code-persisted-per-report version did.
 *
 * ONLY MEANT TO BE USED ON DESKTOP — see Platform.ts's isDesktop(). Device locking is not
 * applied on Report Server or Service (see LicenseEngine.ts), so this fingerprint is only ever
 * computed/shown/checked when isDesktop() is true.
 *
 * Deliberately excludes GPU/WebGL signal — that's a BROWSER-level signal, not hardware-level,
 * and switching browsers (or a GPU driver update) on the same physical machine can report a
 * different string, which would break a device-locked key across browsers on the same PC.
 * Every signal below is OS/hardware-level instead.
 *
 * HONEST LIMITS — this is a browser/OS fingerprint, not a hardware serial number:
 *  - True hardware identifiers (MAC address, disk serial, CPU model/ID) are NOT reachable from
 *    JavaScript in any browser — deliberate, universal browser privacy restriction.
 *  - The closest available CPU-related signal is `navigator.hardwareConcurrency` (logical core
 *    count) — coarse on its own, combined with other signals rather than used alone.
 *  - Stable across: browser switches on the same machine, normal GPU driver updates, closing/
 *    reopening reports, adding the visual to new reports/instances.
 *  - Can change if: the physical monitor/resolution changes, the OS locale/timezone changes,
 *    or the report is opened on a genuinely different machine.
 */

function hashString(input: string): string {
  let hash = 0x811c9dc5; // FNV-1a 32-bit — fast, no crypto needed for a fingerprint (not a secret)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

function collectSignals(): string {
  const parts: string[] = [];
  try { parts.push(String(navigator.hardwareConcurrency || "na")); } catch { parts.push("cpu-na"); }
  try { parts.push(String(screen.width), String(screen.height), String(screen.colorDepth)); } catch { parts.push("screen-na"); }
  try { parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "na"); } catch { parts.push("tz-na"); }
  try { parts.push(navigator.language || "na"); } catch { parts.push("lang-na"); }
  try { parts.push(navigator.platform || "na"); } catch { parts.push("platform-na"); } // OS-level, not browser-level
  return parts.join("::");
}

let cachedCode: string | null = null;

/** Stable code for "this device" — cached in-memory per session to avoid recomputing. */
export function getDeviceCode(): string {
  if (cachedCode) return cachedCode;
  cachedCode = `DEV-${hashString(collectSignals())}`;
  return cachedCode;
}
