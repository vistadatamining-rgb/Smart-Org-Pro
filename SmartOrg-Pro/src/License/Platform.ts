"use strict";

/**
 * Detects whether this visual is running inside Power BI DESKTOP specifically, as opposed to
 * Power BI Service or Power BI Report Server. There is NO officially documented API for this —
 * Microsoft doesn't expose host-platform identity to custom visuals. This is built from real,
 * captured signals (see the two screenshots that informed this), not guesswork:
 *
 *   Power BI Desktop:       hostname ends with ".microsoft.com" (observed: "ms-pbi.pbi.microsoft.com")
 *                            AND the sandbox path contains "cvSandboxPack.html"
 *   Power BI Report Server: hostname is the customer's own on-prem server name (observed:
 *                            "amirhonarmand") AND the sandbox path contains "cvSandboxMinimal.htm"
 *
 * DELIBERATELY FAIL-SAFE: isDesktop() only returns true when BOTH signals positively match the
 * confirmed Desktop pattern. Anything else — Report Server, Power BI Service (not yet directly
 * observed, so treated as "not Desktop" until confirmed otherwise), or any future/unknown
 * rendering context — defaults to false. This matters because "false" means "no device lock" —
 * the safe direction to default toward, since a wrongly-applied device lock is what caused
 * Report Server to freeze/reject valid licenses earlier. Getting it wrong the other way
 * (treating actual Desktop as "not Desktop") just means Desktop temporarily doesn't get the
 * device lock either — annoying, not harmful.
 *
 * If Power BI Service turns out to share Desktop's exact signals (unconfirmed), this check
 * will need a third explicit signal to tell them apart — flag it if device lock unexpectedly
 * shows up on Service.
 */
export function isDesktop(): boolean {
  try {
    const hostname = window.location.hostname || "";
    const href = window.location.href || "";
    return hostname.endsWith(".microsoft.com") && href.includes("cvSandboxPack.html");
  } catch {
    return false; // can't read location -> assume not Desktop, the safe default
  }
}
