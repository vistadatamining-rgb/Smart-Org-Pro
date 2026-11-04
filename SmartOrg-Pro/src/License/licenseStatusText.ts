"use strict";

import { LicenseState } from "./LicenseEngine";

const REASON_LABELS: Record<string, string> = {
  invalid_key: "invalid key",
  wrong_product: "key is for a different visual",
  device_mismatch: "key is locked to another device",
  no_email: "enter your registered email",
  email_mismatch: "email doesn't match the key",
  expired: "expired",
  clock_rollback_detected: "clock change detected"
};

/** Text for the Format pane's License card title and read-only Status field. */
export function licenseCardLabel(state: LicenseState): string {
  if (state.valid) {
    if (state.expiresAt == null) return "License — Active (Unlimited)";
    const d = state.daysLeft ?? 0;
    return `License — Active (until ${new Date(state.expiresAt).toLocaleDateString("en-US")}, ${d} day${d === 1 ? "" : "s"} left)`;
  }
  if (state.reason === "no_license" || state.reason === "checking") return "License — Free version";
  const reasonLabel = REASON_LABELS[state.reason];
  return reasonLabel ? `License — Inactive (${reasonLabel})` : "License — Inactive";
}

export function licenseOverlayText(state: LicenseState): { title: string; sub: string } {
  switch (state.reason) {
    case "invalid_key":
      return { title: "Invalid activation key", sub: "Double-check the key, or contact your vendor." };
    case "wrong_product":
      return { title: "This key is for a different product", sub: "This license key was issued for another visual. Use the key issued for this visual." };
    case "no_email":
      return { title: "Enter your registered email", sub: "Type the email address that was registered with this license key." };
    case "email_mismatch":
      return { title: "Email doesn't match this key", sub: "The email you entered doesn't match the one this key was issued for." };
    case "device_mismatch":
      return { title: "This key is locked to another device", sub: "Send this device's code (from the License pane) to your vendor for a new key." };
    case "expired":
      return { title: "Your license has expired", sub: "Please renew your license." };
    case "clock_rollback_detected":
      return { title: "System clock change detected", sub: "Access to this visual has been blocked for this reason." };
    default:
      return { title: "Access to this visual is restricted", sub: "Please obtain a valid license to continue." };
  }
}
