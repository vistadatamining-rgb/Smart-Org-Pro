"use strict";

/**
 * Core/appInfo.ts
 * Single source of truth for this visual's identity — the About card reads from here instead
 * of hardcoding its own copies. Keep this in sync by hand with pbiviz.json's `visual.version`
 * (there's no runtime API for a visual to read its own manifest) whenever you cut a build.
 *
 * `productName` also doubles as the license scoping key — see License/LicensePayload.ts's
 * `product` field. This must exactly match (case-sensitive) whatever you pass as --product
 * when signing a key for this visual with License-Generator/generate-license.mjs.
 */
export const APP_INFO = {
  version: "2.3.0.0",
  productName: "smartOrgPro",
  displayName: "Smart Org Pro",
  /** Optional prefix a key may carry (e.g. "SOP1.<payload>.<signature>"). Unprefixed keys stay valid. */
  keyPrefix: "SOP1",
  /** Faint product name bottom-left while no valid license is active. */
  watermark: true,
  companyName: "Vista Company",
  companyWebsite: "https://vistacompany.ir/smart-org-pro/",
  privacyUrl: "https://vistacompany.ir/smart-org-pro/"
} as const;
