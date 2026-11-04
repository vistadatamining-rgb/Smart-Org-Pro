"use strict";

import { StorageCtx, storageGet, storageSet } from "./Storage";

const TRIAL_KEY = "trialAnchor";
const TRIAL_DAYS = 3;
const CLOCK_ROLLBACK_TOLERANCE_MS = 2 * 60 * 60 * 1000; // 2h grace for DST/timezone, not days
/** Only write the anti-rollback ratchet to storage once it's advanced at least this much since
 *  the last persisted value. Coarse enough to never recreate the binding loop, fine enough that
 *  rollback protection stays meaningful (a rollback bigger than this + the 2h tolerance is caught). */
const RATCHET_PERSIST_STEP_MS = 10 * 60 * 1000; // 10 minutes

interface TrialAnchor {
  trialStartDate: number; // epoch ms, set once, ever
  lastSeen: number;       // epoch ms, monotonic ratchet
}

export interface TrialStatus {
  active: boolean;
  daysLeft: number;
  tamperDetected: boolean;
  /** Clock-rollback-proof "now" — reuse this for any other expiry check
   *  (e.g. a paid license's expiresAt) so rolling the OS clock back can't
   *  make an already-expired license look valid again either. */
  effectiveNow: number;
}

/**
 * Anchored independently of email/license key on purpose — so typing a
 * different email, or removing/re-adding the visual on another page or
 * report, reads the SAME stored trial instead of starting a fresh one
 * (when the shared V2 storage path is available — see Storage.ts for the
 * Power BI Desktop fallback caveat).
 */
export async function checkTrial(ctx: StorageCtx): Promise<TrialStatus> {
  const now = Date.now();
  let anchor: TrialAnchor | null = null;
  try {
    const raw = await storageGet(ctx, TRIAL_KEY);
    anchor = raw ? (JSON.parse(raw) as TrialAnchor) : null;
  } catch {
    anchor = null;
  }

  if (!anchor) {
    anchor = { trialStartDate: now, lastSeen: now };
    await storageSet(ctx, TRIAL_KEY, JSON.stringify(anchor), true); // force: first anchor must persist
  } else if (now < anchor.lastSeen - CLOCK_ROLLBACK_TOLERANCE_MS) {
    return { active: false, daysLeft: 0, tamperDetected: true, effectiveNow: anchor.lastSeen };
  }

  const effectiveNow = Math.max(now, anchor.lastSeen);
  // Only persist the ratchet when it advances by a MEANINGFUL amount. Forcing a write on every
  // few-millisecond update() (the binding storm) would recreate the persistProperties loop even
  // with force=true; but rollback protection only needs minute-level granularity, not ms. So we
  // advance the in-memory ratchet always, but only force it to storage past this step.
  if (effectiveNow - anchor.lastSeen >= RATCHET_PERSIST_STEP_MS) {
    anchor.lastSeen = effectiveNow;
    await storageSet(ctx, TRIAL_KEY, JSON.stringify(anchor), true); // force: ratchet write must persist for rollback protection
  } else {
    anchor.lastSeen = effectiveNow; // keep in-memory ratchet current without a storage write
  }

  const trialEnd = anchor.trialStartDate + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const active = effectiveNow <= trialEnd;
  const daysLeft = Math.max(0, Math.ceil((trialEnd - effectiveNow) / 86400000));
  return { active, daysLeft, tamperDetected: false, effectiveNow };
}
