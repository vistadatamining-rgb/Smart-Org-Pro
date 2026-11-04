"use strict";

/**
 * Placeholder for a future license server integration (e.g. to additionally
 * enforce "one activation per email across many devices" server-side, which
 * the offline generator explicitly does NOT do — see License-Generator's
 * README, "What this tool does NOT do"). Currently a no-op: LicenseEngine.ts
 * is fully authoritative on its own. Wire a real call in here later without
 * touching LicenseEngine's offline logic.
 */
export async function checkServerHook(_email: string): Promise<null> {
  return null;
}
