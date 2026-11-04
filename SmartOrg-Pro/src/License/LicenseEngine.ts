"use strict";

import { StorageCtx } from "./Storage";
import { verifyLicenseKey } from "./LicenseCrypto";
import { checkTrial } from "./TrialEngine";
import { APP_INFO } from "../Core/appInfo";

/** "licensed" = any valid key (all features). "none" = Free or invalid. There are no tiers. */
export type EffectiveTier = "licensed" | "none";

export interface LicenseState {
  valid: boolean;
  tier: EffectiveTier;
  expiresAt: number | null; // epoch ms; null = unlimited or n/a
  daysLeft: number | null;
  reason: string;           // "ok" | "no_license" (Free) | "checking" | an invalid-key reason
}

const NONE = (reason: string, expiresAt: number | null = null, daysLeft: number | null = null): LicenseState =>
  ({ valid: false, tier: "none", expiresAt, daysLeft, reason });

/** Pasted keys often carry spaces / line breaks; an optional "SOP1." prefix is accepted too. */
export function normalizeKey(raw: string): string {
  let k = (raw || "").replace(/\s+/g, "");
  const pre = APP_INFO.keyPrefix + ".";
  if (k.toUpperCase().startsWith(pre.toUpperCase())) k = k.slice(pre.length);
  return k;
}

/**
 * Check order (same as the Orbit Chart Pro guide):
 * format + signature -> product -> clock tampering -> expiry -> device -> email.
 */
export async function evaluateLicense(
  storage: StorageCtx,
  activationKey: string,
  customerEmail: string,
  deviceCode: string,
  nowMs: number = Date.now()
): Promise<LicenseState> {
  const cleanKey = normalizeKey(activationKey);
  const cleanEmail = (customerEmail || "").trim().toLowerCase();

  // No key at all -> Free version (limited, never locked out).
  if (!cleanKey) return NONE("no_license");

  const verified = await verifyLicenseKey(cleanKey);
  if (!verified) return NONE("invalid_key");
  const p = verified.payload;

  if (p.product !== APP_INFO.productName) return NONE("wrong_product");

  // Layer A (no storage needed): the clock must not be before the key's own issue date.
  const CLOCK_ROLLBACK_TOLERANCE_MS = 2 * 60 * 60 * 1000;
  if (p.issuedAt) {
    const issuedAtMs = Date.parse(p.issuedAt);
    if (!Number.isNaN(issuedAtMs) && nowMs < issuedAtMs - CLOCK_ROLLBACK_TOLERANCE_MS) {
      return NONE("clock_rollback_detected");
    }
  }
  // Layer B (storage ratchet): the clock must not go behind the last time we saw it.
  const seen = await checkTrial(storage);
  if (seen.tamperDetected) return NONE("clock_rollback_detected");
  const effectiveNow = Math.max(nowMs, seen.effectiveNow);

  // Expiry
  let expiresAtMs: number | null = null;
  if (p.expiresAt != null) {
    expiresAtMs = Date.parse(p.expiresAt);
    if (Number.isNaN(expiresAtMs) || effectiveNow > expiresAtMs) return NONE("expired", expiresAtMs, 0);
  }

  // Device lock
  if (p.deviceCode && p.deviceCode !== deviceCode) return NONE("device_mismatch");

  // Email lock (case-insensitive)
  if (p.boundEmail) {
    if (!cleanEmail) return NONE("no_email");
    if (p.boundEmail.trim().toLowerCase() !== cleanEmail) return NONE("email_mismatch");
  }

  return {
    valid: true,
    tier: "licensed",
    expiresAt: expiresAtMs,
    daysLeft: expiresAtMs == null ? null : Math.ceil((expiresAtMs - effectiveNow) / 86400000),
    reason: "ok"
  };
}
