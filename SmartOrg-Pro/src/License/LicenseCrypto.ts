"use strict";

/**
 * License signature verification using @noble/curves (pure JavaScript, zero native
 * dependencies) instead of the browser's native `crypto.subtle` Web Crypto API.
 *
 * WHY: `crypto.subtle` only exists in a browser "secure context" — https://, or localhost.
 * Power BI Report Server served over plain http:// (the common on-prem default unless someone
 * has explicitly configured HTTPS) is NOT a secure context, so `crypto.subtle` is simply
 * `undefined` there — every signature check silently failed, no matter what the license key
 * contained. Confirmed via a browser console error before this fix (see project notes).
 * @noble/curves does the same ECDSA math in plain JS with no dependency on that browser API,
 * so it works identically over http:// and https://.
 *
 * The GENERATOR (License-Generator/generate-license-*.mjs) is unaffected by any of this and
 * keeps using Node's `crypto.webcrypto` to sign keys — Node.js has no "secure context"
 * concept, that restriction is purely a browser page-origin policy. Signatures produced by
 * Web Crypto API's ECDSA are in raw (r || s) "compact" format, which is exactly the format
 * @noble/curves expects by default — no format conversion needed between the two sides.
 */
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { LICENSE_PUBLIC_KEY_JWK } from "./publicKey";
import { base64UrlDecode } from "./base64url";
import { LicensePayload } from "./LicensePayload";

/** Converts the stored JWK (x/y coordinates, base64url) into the raw uncompressed SEC1 point
 *  format (0x04 || x || y) that @noble/curves' verify() expects for the public key. */
function jwkToRawPoint(jwk: JsonWebKey): Uint8Array {
  if (!jwk.x || !jwk.y) throw new Error("Public key JWK is missing x/y — did you paste the real key from --init?");
  const x = base64UrlDecode(jwk.x);
  const y = base64UrlDecode(jwk.y);
  const point = new Uint8Array(1 + x.length + y.length);
  point[0] = 0x04; // uncompressed point marker
  point.set(x, 1);
  point.set(y, 1 + x.length);
  return point;
}

let cachedPublicKeyPoint: Uint8Array | null = null;
function getPublicKeyPoint(): Uint8Array {
  if (!cachedPublicKeyPoint) {
    cachedPublicKeyPoint = jwkToRawPoint(LICENSE_PUBLIC_KEY_JWK);
  }
  return cachedPublicKeyPoint;
}

export interface VerifiedLicense {
  payload: LicensePayload;
}

/**
 * Verifies a "<base64url payload>.<base64url signature>" license key string entirely offline
 * — no fetch, no network privilege needed. Returns null for anything malformed, unsigned, or
 * signed with the wrong key. Kept `async` for call-site compatibility even though the
 * underlying verification is synchronous pure-JS math.
 */
export async function verifyLicenseKey(licenseKey: string): Promise<VerifiedLicense | null> {
  try {
    const parts = licenseKey.trim().split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;

    const payloadBytes = base64UrlDecode(payloadB64);
    const signature = base64UrlDecode(sigB64);
    const msgHash = sha256(payloadBytes);
    const publicKeyPoint = getPublicKeyPoint();

    // lowS: false — Web Crypto API's ECDSA signatures aren't guaranteed to be "low-S"
    // normalized, and @noble/curves rejects high-S signatures by default (anti-malleability
    // hardening meant for on-chain use). We don't need that guarantee here — signature
    // malleability isn't a threat model concern for offline license verification — and
    // requiring it would reject a fraction of otherwise-genuine Web-Crypto-signed keys.
    const ok = p256.verify(signature, msgHash, publicKeyPoint, { lowS: false });
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicensePayload;
    return { payload };
  } catch (err) {
    console.error("SmartOrgPro license: signature verification threw an unexpected error.", err);
    return null;
  }
}
