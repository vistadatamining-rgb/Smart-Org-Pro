"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import PrivilegeStatus = powerbi.PrivilegeStatus;

/**
 * Power BI Desktop does not support the local storage API for custom
 * visuals AT ALL, by design — storageV2Service.status() always resolves to
 * DisabledByAdmin there, regardless of capabilities.json or org settings
 * (confirmed via Microsoft's own developer community). Power BI Service
 * (the web app) does support it when the org allows it.
 *
 * So: try storageV2Service first: it's shared across every instance of this
 * visual, on any page, any report, on this machine — the ONLY thing that
 * actually satisfies "don't reset the trial when the visual is re-added
 * elsewhere". When it's unavailable (Desktop, or blocked by an admin),
 * fall back to persistProperties, which writes into the report file itself.
 * That fallback is real and works everywhere, but it's scoped to THIS ONE
 * visual instance/page — re-adding the visual elsewhere starts a fresh
 * trial under the fallback path. See README for this trade-off.
 */

const FALLBACK_OBJECT = "licenseStorageFallback";

/** Don't re-persist the same key via persistProperties more than once per this window — see
 *  the loop explanation in storageSet(). The trial ratchet only needs to survive to the next
 *  session, so a coarse throttle is plenty and it's what keeps data binding from freezing. */
const PERSIST_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** In-memory record of the last value+time we persisted per key, to suppress redundant/rapid
 *  writes. Lives for the session; that's exactly the scope needed to break the update loop. */
const lastPersisted: Record<string, { value: string; at: number }> = {};

export interface StorageCtx {
  host: IVisualHost;
  dataView: DataView | undefined;
}

let v2AvailableCache: Promise<boolean> | null = null;

function isV2Available(host: IVisualHost): Promise<boolean> {
  const svc = (host as unknown as { storageV2Service?: { status: () => Promise<PrivilegeStatus> } }).storageV2Service;
  if (!svc) return Promise.resolve(false);
  if (!v2AvailableCache) {
    v2AvailableCache = svc.status()
      .then(status => status === PrivilegeStatus.Allowed)
      .catch(() => false);
  }
  return v2AvailableCache;
}

export async function storageGet(ctx: StorageCtx, key: string): Promise<string | null> {
  if (await isV2Available(ctx.host)) {
    try {
      const svc = (ctx.host as unknown as { storageV2Service: { get: (k: string) => Promise<string> } }).storageV2Service;
      const val = await svc.get(key);
      if (val != null) return val;
    } catch {
      // key not set yet, or blocked mid-session -> fall through
    }
  }

  try {
    const objects = ctx.dataView && ctx.dataView.metadata && ctx.dataView.metadata.objects;
    const raw = objects && objects[FALLBACK_OBJECT] && (objects[FALLBACK_OBJECT][key] as unknown as string);
    return raw != null ? String(raw) : null;
  } catch {
    return null;
  }
}

export async function storageSet(ctx: StorageCtx, key: string, value: string, force: boolean = false): Promise<void> {
  if (await isV2Available(ctx.host)) {
    try {
      const svc = (ctx.host as unknown as { storageV2Service: { set: (k: string, v: string) => unknown } }).storageV2Service;
      await Promise.resolve(svc.set(key, value));
      return;
    } catch {
      // fall through to persistProperties
    }
  }

  // persistProperties writes into the report, which makes Power BI fire ANOTHER update() —
  // which runs the license/trial check again, which calls storageSet again... On Power BI
  // Desktop (where storageV2 is never available, so we're always on this fallback path) that
  // becomes a tight persistProperties -> update -> persistProperties feedback loop. During
  // data binding — when Power BI is already firing rapid update()s as fields land — that loop
  // is what freezes the whole editor and blocks further field drags.
  //
  // `force` marks a security-critical write (the trial anchor's creation, and the anti-
  // rollback ratchet advancing) that must NOT be dropped, since skipping it is exactly what
  // would let a clock-rollback go undetected across sessions. Forced writes still de-dupe on
  // identical value (guard 1) so they can't loop on unchanged data, but they ignore the time
  // throttle (guard 2). Ordinary writes honor both guards and stay loop-safe.
  const lastVal = lastPersisted[key];
  if (lastVal && lastVal.value === value) return; // guard 1: identical value — nothing to write, ever

  if (!force) {
    const nowMs = Date.now();
    if (lastVal && nowMs - lastVal.at < PERSIST_THROTTLE_MS) {
      lastPersisted[key] = { value, at: lastVal.at }; // remember latest value, keep old timestamp
      return;
    }
  }

  lastPersisted[key] = { value, at: Date.now() };

  try {
    ctx.host.persistProperties({
      merge: [{
        objectName: FALLBACK_OBJECT,
        selector: {},
        properties: { [key]: value }
      }]
    });
  } catch {
    // best-effort — a failed write just means we re-derive next update()
  }
}
