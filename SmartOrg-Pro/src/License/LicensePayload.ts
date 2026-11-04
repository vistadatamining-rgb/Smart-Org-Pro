"use strict";

export type Tier = "pro" | "premium";
export type Period = "daily" | "monthly" | "yearly" | "unlimited";

export interface LicensePayload {
  product: string;           // which visual this key is for (must match APP_INFO.productName) — a key for one visual is refused by any other
  tier?: Tier;               // legacy field — ignored: any valid key unlocks everything (no Pro/Premium levels)
  period: Period;
  issuedAt: string;          // ISO string
  expiresAt: string | null;  // ISO string, or null for unlimited
  boundEmail?: string;       // informational only now — not enforced, see LicenseEngine.ts
  deviceCode?: string;       // Desktop-only lock — see Platform.ts and LicenseEngine.ts
  licensee?: string;         // free-text traceability label, not enforced
}
