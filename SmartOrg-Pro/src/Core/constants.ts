"use strict";

import { EffectiveTier } from "../License/LicenseEngine";

export type FeatureKey =
  | "cardStyleChoice"
  | "layoutChoice"
  | "connectorStyleChoice"
  | "connectorColor"
  | "progressBarStyleChoice"
  | "themeChoice"
  | "departmentColors"
  | "focusMode"
  | "hoverDetailPanel"
  | "animations"
  | "collapseExpand"
  | "zoomControl"
  | "departmentLegend"
  | "dataCard";

const FULL_ACCESS: Record<FeatureKey, boolean> = {
  cardStyleChoice: true,
  layoutChoice: true,
  connectorStyleChoice: true,
  connectorColor: true,
  progressBarStyleChoice: true,
  themeChoice: true,
  departmentColors: true,
  focusMode: true,
  hoverDetailPanel: true,
  animations: true,
  collapseExpand: true,
  zoomControl: true,
  departmentLegend: true,
  dataCard: true
};

// Everything locked to its default except basic collapse/expand navigation,
// which stays on so the chart is still minimally usable while unlicensed.
const RESTRICTED: Record<FeatureKey, boolean> = {
  cardStyleChoice: false,
  layoutChoice: false,
  connectorStyleChoice: false,
  connectorColor: false,
  progressBarStyleChoice: false,
  themeChoice: false,
  departmentColors: false,
  focusMode: false,
  hoverDetailPanel: false,
  animations: false,
  collapseExpand: true,
  // Zoom is plain navigation (like collapse/expand) — stays usable unlicensed.
  zoomControl: true,
  departmentLegend: false,
  dataCard: false
};

export const FEATURE_MATRIX: Record<EffectiveTier, Record<FeatureKey, boolean>> = {
  licensed: FULL_ACCESS,
  none: RESTRICTED
};

/** Human-readable names, used by the Free-version popup to list what a license unlocks. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  cardStyleChoice: "Card styles",
  layoutChoice: "Layout options",
  connectorStyleChoice: "Connector styles",
  connectorColor: "Connector color",
  progressBarStyleChoice: "Progress bar styles",
  themeChoice: "Themes",
  departmentColors: "Department colors",
  focusMode: "Focus mode",
  hoverDetailPanel: "Hover detail panel",
  animations: "Animations",
  collapseExpand: "Collapse / expand",
  zoomControl: "Zoom controls",
  departmentLegend: "Department legend",
  dataCard: "KPI data cards"
};

/** What is still locked right now: nothing with a valid license, every Free-locked feature otherwise. */
export function lockedSections(valid: boolean): string[] {
  if (valid) return [];
  return (Object.keys(RESTRICTED) as FeatureKey[]).filter(k => !RESTRICTED[k]).map(k => FEATURE_LABELS[k]);
}
