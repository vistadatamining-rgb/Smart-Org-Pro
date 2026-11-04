"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import DataViewTableColumn = powerbi.DataViewMetadataColumn;
import IViewport = powerbi.IViewport;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";
import { evaluateLicense, LicenseState } from "./License/LicenseEngine";
import { licenseCardLabel, licenseOverlayText } from "./License/licenseStatusText";
import { StorageCtx } from "./License/Storage";
import { getDeviceCode } from "./License/DeviceFingerprint";
import { APP_INFO } from "./Core/appInfo";
import { FEATURE_MATRIX, lockedSections } from "./Core/constants";

interface OrgKpi { label: string; value: number; }
/** One numeric field shown in the always-visible data card under a person's card
 *  (sales, profit, order count, discount, ...). `raw` keeps the unrounded number so
 *  the decimals/compact formatting settings can be applied at render time.
 *  `target` is the EXPLICIT target (measure or manual) — null if neither is set.
 *  See `relativeMax` for what happens then. */
interface OrgStat {
  label: string;
  raw: number;
  target: number | null;
  /** Highest raw value for this same stat slot across ALL nodes, computed after
   *  parsing. Used as a fallback "target" purely to draw a progress bar when the
   *  user hasn't bound a target measure or typed a manual one — without this,
   *  a raw number like Sales has no 0-100 scale to draw a bar against, and the
   *  data card silently shows numbers only (which is what kept happening). */
  relativeMax: number | null;
  /** Optional — from the "Data card previous period" role, paired by drop order.
   *  Null when not bound. Powers the tooltip's Previous/Growth rows only; nothing
   *  else in the KPI area depends on it. */
  previous: number | null;
}
interface OrgNode {
  id: string;
  /** Row position in dataView.table.rows — used to build this node's selection id. */
  rowIndex: number;
  parentId: string | null;
  name: string;
  title: string;
  department: string;
  photo: string;
  badge: string;
  performance: number;
  kpis: OrgKpi[];
  stats: OrgStat[];
  /** Paired with stats by index: displayName of the stat measure, and optionally the target measure. */
  statMeasureNames: Array<{ stat: string; target: string | null }>;
}
interface Pt { x: number; y: number; }

const CARD_STYLE_DEFS: Record<string, { height: number; avatarCenterX: (cardW: number) => number }> = {
  glass:    { height: 172, avatarCenterX: (w) => w / 2 },
  pill:     { height: 86,  avatarCenterX: () => 31 },
  minimal:  { height: 138, avatarCenterX: (w) => w / 2 },
  ribbon:   { height: 152, avatarCenterX: (w) => w / 2 },
  outline:  { height: 132, avatarCenterX: (w) => w / 2 },
  photoBg:  { height: 158, avatarCenterX: (w) => w / 2 },
  neumorph: { height: 150, avatarCenterX: (w) => w / 2 }
};

const PILL_PALETTES: Record<string, [string, string][]> = {
  vibrant:    [["#7b2ff7", "#5b21b6"], ["#e6007a", "#c2185b"], ["#1e88e5", "#1565c0"], ["#00bfa5", "#00897b"]],
  sunset:     [["#ff7e5f", "#eb5757"], ["#ff5e62", "#ff9966"], ["#f7971e", "#e07b00"], ["#f857a6", "#c2185b"]],
  ocean:      [["#005c97", "#363795"], ["#2193b0", "#1a6f85"], ["#00b4ff", "#0072ff"], ["#43cea2", "#185a9d"]],
  emerald:    [["#134e5e", "#0e3a45"], ["#11998e", "#0c6e65"], ["#2c7744", "#1f5731"], ["#3fbf9f", "#2a8a72"]],
  monochrome: [["#4a4a52", "#2c2c33"], ["#5c5c66", "#3a3a42"], ["#6e6e78", "#48484f"], ["#80808a", "#565660"]]
};

const THEMES: Record<string, Record<string, string>> = {
  darkNeon: {
    "--bg-0": "#0b0e14", "--bg-1": "#10141d", "--card": "#161b26", "--card-border": "#232a3a",
    "--text-0": "#eef1f7", "--text-1": "#8b93a7", "--text-2": "#5b6478",
    "--accent-a": "#6d5bf5", "--accent-b": "#3ba7ff", "--accent-c": "#ff4d8d",
    "--good": "#33d17a", "--warn": "#ffb238", "--bad": "#ff5c5c", "--line": "#2a3142",
    "--panel-bg": "rgba(22,27,38,.78)", "--shadow": "rgba(0,0,0,.55)"
  },
  corporate: {
    "--bg-0": "#eef1f6", "--bg-1": "#e4e8f0", "--card": "#ffffff", "--card-border": "#dfe4ee",
    "--text-0": "#1c2333", "--text-1": "#5b6478", "--text-2": "#8a92a6",
    "--accent-a": "#1e3a8a", "--accent-b": "#2563eb", "--accent-c": "#7c3aed",
    "--good": "#16a34a", "--warn": "#d97706", "--bad": "#dc2626", "--line": "#e4e8f0",
    "--panel-bg": "rgba(255,255,255,.9)", "--shadow": "rgba(30,58,138,.15)"
  },
  finance: {
    "--bg-0": "#0a0f12", "--bg-1": "#0e1518", "--card": "#111a1e", "--card-border": "#1f2e33",
    "--text-0": "#eef4f1", "--text-1": "#8fa39c", "--text-2": "#5c6e68",
    "--accent-a": "#d4af37", "--accent-b": "#16a34a", "--accent-c": "#d4af37",
    "--good": "#22c55e", "--warn": "#d4af37", "--bad": "#e11d48", "--line": "#1f2e33",
    "--panel-bg": "rgba(17,26,30,.82)", "--shadow": "rgba(0,0,0,.6)"
  },
  hr: {
    "--bg-0": "#fff8f2", "--bg-1": "#fdeee2", "--card": "#ffffff", "--card-border": "#fbe0cd",
    "--text-0": "#3a2a20", "--text-1": "#8a6f5c", "--text-2": "#b09880",
    "--accent-a": "#ff7a59", "--accent-b": "#ffab73", "--accent-c": "#ff5c8a",
    "--good": "#38b06a", "--warn": "#f0a83c", "--bad": "#e6604f", "--line": "#fbe0cd",
    "--panel-bg": "rgba(255,255,255,.92)", "--shadow": "rgba(255,122,89,.18)"
  },
  healthcare: {
    "--bg-0": "#f2fbfa", "--bg-1": "#e5f6f4", "--card": "#ffffff", "--card-border": "#d9f0ec",
    "--text-0": "#173330", "--text-1": "#4f7a74", "--text-2": "#88ada7",
    "--accent-a": "#14b8a6", "--accent-b": "#0ea5e9", "--accent-c": "#14b8a6",
    "--good": "#10b981", "--warn": "#f59e0b", "--bad": "#ef4444", "--line": "#d9f0ec",
    "--panel-bg": "rgba(255,255,255,.92)", "--shadow": "rgba(20,184,166,.16)"
  },
  appleGlass: {
    "--bg-0": "#eef2fb", "--bg-1": "#e4eaf8", "--card": "rgba(255,255,255,.55)", "--card-border": "rgba(255,255,255,.7)",
    "--text-0": "#1b2436", "--text-1": "#5a6480", "--text-2": "#8b93a7",
    "--accent-a": "#5b7cfa", "--accent-b": "#3ba7ff", "--accent-c": "#a78bfa",
    "--good": "#22c55e", "--warn": "#f59e0b", "--bad": "#ef4444", "--line": "#dfe6f5",
    "--panel-bg": "rgba(255,255,255,.6)", "--shadow": "rgba(91,124,250,.18)"
  }
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function lerpColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function darken(hex: string, amount: number): string {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
function cleanKpiLabel(label: string): string {
  return label.replace(/^(Sum|Average|Avg|Count|Min|Max|Median)\s+of\s+/i, "");
}

/** Formats a data-card number. `compact` turns 1234567 into 1.2M so four values still
 *  fit under a ~150px card; otherwise a plain grouped number with `decimals` places.
 *  Deliberately hand-rolled instead of pulling in powerbi-visuals-utils-formattingutils,
 *  which isn't a dependency of this project. */
/** Index -> style-name lookup tables for the data card's NumUpDown-based pickers.
 *  See the comment on settings.ts's `style`/`layout`/`barStyle` for why these are
 *  numeric indices instead of a proper ItemDropdown. Out-of-range indices clamp to
 *  the last valid entry rather than throwing, since a stray/corrupted saved value
 *  (or the format pane bug itself) shouldn't be able to crash rendering. */
const DC_STYLE_NAMES = ["glass", "neon", "gradient", "sidebar", "elevated", "outline", "solid", "frost"];

/** Local fallback avatar (a simple gray silhouette), used whenever a node has no
 *  Photo URL bound. Deliberately an inline SVG data URI — not an external URL — so
 *  the visual never makes a network request just to show a placeholder. This also
 *  matters for Microsoft AppSource submission, which requires the sample .pbix to
 *  render fully offline; the previous `https://via.placeholder.com/120` fallback
 *  would have silently broken that requirement for any row with no photo. */
const FALLBACK_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzJhMzE0MiIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNDYiIHI9IjIyIiBmaWxsPSIjNWI2NDc4Ii8+PHBhdGggZD0iTTYwIDc0Yy0yNCAwLTQwIDEzLTQwIDI5djE3aDgwdi0xN2MwLTE2LTE2LTI5LTQwLTI5eiIgZmlsbD0iIzViNjQ3OCIvPjwvc3ZnPgo=";

const PROGRESS_STYLE_NAMES = ["classic", "segmented", "marker", "gradient"];
const TOOLTIP_STYLE_NAMES = ["minimal", "executive", "modernDark", "glass", "detailed"];

/**
 * containerStyle/progressStyle/tooltipStyle are real ItemDropdown controls (converted
 * from the NumUpDown-index workaround per the user's explicit request), so their raw
 * `.value` is a `{value, displayName}` object whose `.value` is already one of the
 * strings in `names` — NOT a numeric index. This replaces a real regression: the
 * dropdown's VALUE OBJECT was being fed into a function expecting a plain number
 * (`Math.round(Number(anObject))` is always `NaN`), which silently fell through to
 * `names[0]` every time — so Container/Progress/Tooltip style all APPEARED to do
 * nothing no matter what was picked, always rendering the first style.
 */
function pickByName(names: string[], raw: unknown): string {
  const v = (raw as { value?: unknown } | null | undefined)?.value;
  return (typeof v === "string" && names.includes(v)) ? v : names[0];
}

function formatStat(value: number, decimals: number, compact: boolean): string {
  if (!isFinite(value)) return "—";
  const d = Math.max(0, Math.min(4, Math.round(decimals) || 0));
  const abs = Math.abs(value);
  if (compact && abs >= 1000) {
    const units: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (const [size, suffix] of units) {
      if (abs >= size) {
        const scaled = value / size;
        // One decimal below 100 (9.4M), none above (340M) — keeps the string short.
        return scaled.toFixed(Math.abs(scaled) < 100 ? 1 : 0).replace(/\.0$/, "") + suffix;
      }
    }
  }
  return value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Formats an achievement percentage defensively. A badly mismatched manual target
 * (e.g. a target of 4,000,000 typed against sales in the billions) produces an
 * achievement in the hundreds of thousands of percent — printed as-is, a number that
 * long breaks badge/row widths across the whole KPI area. Cap the DISPLAYED text at
 * 999%+ ; the real number still drives color/bar-scale math elsewhere, only the label
 * here is capped.
 */
function formatAchievementPct(pct: number): string {
  if (!isFinite(pct)) return "—";
  if (pct > 999) return "999%+";
  if (pct < -999) return "-999%+";
  return Math.round(pct) + "%";
}

/**
 * Resolves a ColorPicker value to a live theme CSS variable when it's still sitting at
 * its untouched compiled default — so the KPI Performance area follows the visual's
 * theme picker automatically out of the box, exactly like everything else in the
 * visual — while any color the user has actually picked always overrides the theme.
 * ColorPicker has no built-in "inherit" state, so this compares against the known
 * default hex as a practical stand-in for "the user hasn't touched this field".
 */
function resolveThemeColor(pickedHex: string, defaultHex: string, themeVar: string): string {
  return pickedHex.toLowerCase() === defaultHex.toLowerCase() ? themeVar : pickedHex;
}

function autoBadge(perf: number): string {
  if (perf >= 95) return "👑";
  if (perf >= 90) return "🏆";
  if (perf >= 85) return "⭐";
  if (perf >= 75) return "🚀";
  if (perf >= 60) return "🎯";
  return "";
}

function colIndex(cols: DataViewTableColumn[], role: string): number {
  return cols.findIndex(c => c.roles && c.roles[role]);
}

const SVGNS = "http://www.w3.org/2000/svg";

/** How often the visual re-checks trial/license expiry on its own (see performSelfCheck()). */
const SELF_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/** How long to wait after the last activation-key/email change before actually re-checking the
 *  license — prevents a check (and storage write) firing on every single keystroke. */
const LICENSE_DEBOUNCE_MS = 600;
/** Even if update() keeps firing (for reasons unrelated to typing) and keeps resetting the
 *  debounce above, the license check still runs at least this often — otherwise a host that
 *  calls update() more frequently than the debounce window (observed on Report Server) could
 *  reset the timer forever and the check would never actually run. */
const LICENSE_MAX_WAIT_MS = 1500;

function mkEl(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
function mkText(tag: string, className: string, text: string): HTMLElement {
  const e = mkEl(tag, className);
  e.textContent = text;
  return e;
}
function mkImg(src: string, className?: string): HTMLImageElement {
  const img = document.createElement("img");
  if (className) img.className = className;
  img.src = src;
  img.alt = "";
  return img;
}
function mkSvg(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

export class Visual implements IVisual {
  private target: HTMLElement;
  private host: IVisualHost;
  private formattingSettingsService: FormattingSettingsService;
  private formattingSettings: VisualFormattingSettingsModel = new VisualFormattingSettingsModel();

  private scrollEl: HTMLDivElement;
  private zoomWrapEl: HTMLDivElement;
  private wrapEl: HTMLDivElement;
  private svgEl: SVGSVGElement;
  private nodesEl: HTMLDivElement;
  private legendEl: HTMLDivElement;
  private zoomCtrlEl: HTMLDivElement;
  private zoomLabelEl: HTMLSpanElement;
  private lastViewport: IViewport;
  private lastDataView: DataView | undefined;
  private selfCheckIntervalId: number | null = null;

  /** Selection + context menu (Microsoft certification items 1180.2.2.3 and 1180.2.5).
   *  Only API 2.x features are used (createSelectionManager / showContextMenu), so nothing
   *  here raises the minimum host version above what Report Server 2022+ already needs. */
  private selectionManager: ISelectionManager;
  private nodeSelectionIds: Record<string, ISelectionId> = {};
  private hintEl: HTMLDivElement;

  private nodes: OrgNode[] = [];
  private nodesById: Record<string, OrgNode> = {};
  private childrenMap: Record<string, string[]> = {};
  private roots: string[] = [];
  private collapsedIds: Set<string> = new Set();
  /** Which nodes currently show their KPI Performance area expanded (vs. the compact
   *  default). Per-node, toggled by clicking that node's KPI area — mirrors
   *  collapsedIds' click-to-toggle-then-re-render pattern immediately above. */
  private expandedKpiIds: Set<string> = new Set();
  private focusedId: string | null = null;
  private cardHeight: number = CARD_STYLE_DEFS.glass.height;
  private departmentColors: Record<string, string> = {};
  /** Ordered department list, so the legend keeps a stable order across renders. */
  private departmentOrder: string[] = [];
  /** this.cardHeight is now BASE card height only (photo/name/title area) — it no
   *  longer has the KPI Performance area folded in. That area's height varies per
   *  node (collapsed vs. expanded, and how many KPIs are visible), so folding a single
   *  number into cardHeight and applying it to every node uniformly was the root cause
   *  of a real layout bug: expanding ONE person's KPI area inflated the box height (and
   *  the gap to the next hierarchy level) for every OTHER, still-collapsed person too,
   *  which is what produced disconnected-looking cards and orphaned collapse toggles
   *  floating away from their own (now much smaller) content. See kpiHeightById below. */
  private dataCardHeight: number = 0;
  /** Each node's OWN current KPI Performance area height, keyed by node id — 0/absent
   *  for a node with the area disabled or no stats. This is what makes each node's box
   *  (and the vertical gap to its children) reflect its OWN collapsed/expanded state
   *  instead of whichever node on the whole chart happens to be tallest right now.
   *  dataCardHeight (above) is kept as the single GLOBAL max across all nodes, used
   *  only as a conservative fallback for layout modes (horizontal, radial) and the
   *  connector-drawing helper that were not part of the reported bug and are safer left
   *  using the old uniform approach than risked being reworked without being able to
   *  visually verify every mode. */
  private kpiHeightById: Record<string, number> = {};

  /** Unzoomed stage size from the last render — the zoom wrapper multiplies these. */
  private stageW: number = 0;
  private stageH: number = 0;

  private zoom: number = 1;
  /** Guards against the "Default zoom (%)" setting stomping a zoom the user has
   *  already changed by hand: the setting is only re-applied when its own value changes. */
  private lastDefaultZoomSetting: number | null = null;

  private lastLicenseInputs: string = "\u0000uninitialized";
  private deviceCode: string = "";
  private licenseDebounceId: number | null = null;
  private licenseDebounceBurstStart: number | null = null;
  private licenseState: LicenseState = { valid: false, tier: "none", expiresAt: null, daysLeft: null, reason: "checking" };
  private licenseOverlayEl: HTMLDivElement;
  private licenseBadgeEl: HTMLDivElement;
  private licensePopupEl: HTMLDivElement;
  private watermarkEl: HTMLDivElement;
  private popupHideTimer: number | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.target = options.element;
    this.formattingSettingsService = new FormattingSettingsService();
    this.selectionManager = this.host.createSelectionManager();
    // Keeps highlight state in sync when the selection is changed or cleared from outside
    // (another visual, a bookmark, the context menu, Esc / click on the report canvas).
    this.selectionManager.registerOnSelectCallback(() => this.applySelection());

    // The scrolling now happens on an inner element (.sop-scroll) instead of on the
    // host element itself. That's what lets the legend panel and the zoom buttons sit
    // OUTSIDE the scrolled/zoomed area — otherwise they'd scroll away with the chart
    // and shrink/grow with the zoom transform.
    this.target.style.overflow = "hidden";
    this.target.style.position = "relative";
    this.target.classList.add("sop-root");

    this.scrollEl = document.createElement("div");
    this.scrollEl.className = "sop-scroll";
    this.target.appendChild(this.scrollEl);

    // Sized to width*zoom / height*zoom so the scrollbars match what's actually on
    // screen — a CSS transform doesn't affect layout size, so without this wrapper
    // zooming in would clip the chart instead of letting you scroll to the rest of it.
    this.zoomWrapEl = document.createElement("div");
    this.zoomWrapEl.className = "sop-zoomwrap";
    this.scrollEl.appendChild(this.zoomWrapEl);

    this.wrapEl = document.createElement("div");
    this.wrapEl.className = "sop-stage";
    this.zoomWrapEl.appendChild(this.wrapEl);

    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.setAttribute("class", "sop-connlayer");
    this.wrapEl.appendChild(this.svgEl);

    const SVGNS = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(SVGNS, "defs");
    const grad = document.createElementNS(SVGNS, "linearGradient");
    grad.setAttribute("id", "sopRingGrad");
    grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "1"); grad.setAttribute("y2", "1");
    const stop1 = document.createElementNS(SVGNS, "stop");
    stop1.setAttribute("offset", "0%"); stop1.setAttribute("stop-color", "var(--accent-b)");
    const stop2 = document.createElementNS(SVGNS, "stop");
    stop2.setAttribute("offset", "100%"); stop2.setAttribute("stop-color", "var(--good)");
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    this.svgEl.appendChild(defs);

    this.nodesEl = document.createElement("div");
    this.nodesEl.className = "sop-nodes";
    this.wrapEl.appendChild(this.nodesEl);

    this.legendEl = document.createElement("div");
    this.legendEl.className = "sop-legend";
    this.target.appendChild(this.legendEl);

    this.zoomCtrlEl = document.createElement("div");
    this.zoomCtrlEl.className = "sop-zoomctrl";
    this.zoomLabelEl = document.createElement("span");
    this.zoomLabelEl.className = "sop-zoom-label";
    this.zoomLabelEl.textContent = "100%";
    const zoomOut = mkText("button", "sop-zoom-btn", "\u2212");
    const zoomIn = mkText("button", "sop-zoom-btn", "+");
    const zoomReset = mkText("button", "sop-zoom-btn sop-zoom-reset", "\u27F2");
    zoomOut.title = "Zoom out (Ctrl + wheel down)";
    zoomIn.title = "Zoom in (Ctrl + wheel up)";
    zoomReset.title = "Reset zoom";
    zoomOut.addEventListener("click", () => this.setZoom(this.zoom / 1.2));
    zoomIn.addEventListener("click", () => this.setZoom(this.zoom * 1.2));
    zoomReset.addEventListener("click", () => this.setZoom(this.defaultZoomValue()));
    this.zoomCtrlEl.appendChild(zoomOut);
    this.zoomCtrlEl.appendChild(this.zoomLabelEl);
    this.zoomCtrlEl.appendChild(zoomIn);
    this.zoomCtrlEl.appendChild(zoomReset);
    this.target.appendChild(this.zoomCtrlEl);

    // Ctrl + wheel = zoom. passive:false is required — a passive listener can't call
    // preventDefault(), and without preventDefault() the browser/host would run its own
    // page zoom on Ctrl+wheel and the chart would never get the gesture.
    this.scrollEl.addEventListener("wheel", (e: WheelEvent) => this.onWheel(e), { passive: false });

    // Click on empty space clears the selection (and so releases the filter on other visuals).
    this.scrollEl.addEventListener("click", (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest(".sop-node")) return;
      if (this.colSel.size || this.currentDeptFilter) this.clearCrossFilters();
      this.selectionManager.clear().then(() => this.applySelection());
    });
    // Standard Power BI right-click menu. Node handlers stop propagation, so this only
    // fires for empty space (menu without a data point: Show data / Export / Spotlight...).
    this.target.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
    });

    this.hintEl = document.createElement("div");
    this.hintEl.className = "sop-hint";
    // textContent only (no innerHTML): certification flags HTML injection sinks.
    const hintLines = [
      "Smart Org Pro",
      "Add Employee ID and Manager ID (required), then Name, Title, Department, Photo URL and Performance %.",
      "Click a card to filter other visuals (Ctrl+click for several). Right-click for the Power BI menu."
    ];
    const hintBox = document.createElement("div");
    hintLines.forEach((line, i) => {
      const p = document.createElement(i === 0 ? "strong" : "p");
      p.textContent = line;
      hintBox.appendChild(p);
    });
    this.hintEl.appendChild(hintBox);
    this.target.appendChild(this.hintEl);

    // Free-version badge (bottom-right) + hover popup listing what a license unlocks.
    this.licenseBadgeEl = document.createElement("div");
    this.licenseBadgeEl.className = "sop-license-badge";
    this.licenseBadgeEl.tabIndex = 0;
    this.target.appendChild(this.licenseBadgeEl);

    this.licensePopupEl = document.createElement("div");
    this.licensePopupEl.className = "sop-license-popup";
    this.target.appendChild(this.licensePopupEl);
    const openPopup = () => {
      if (this.popupHideTimer !== null) { window.clearTimeout(this.popupHideTimer); this.popupHideTimer = null; }
      if (this.licenseBadgeEl.classList.contains("show")) this.licensePopupEl.classList.add("open");
    };
    // 180 ms grace so the pointer can travel from the badge into the popup.
    const closePopup = () => {
      if (this.popupHideTimer !== null) window.clearTimeout(this.popupHideTimer);
      this.popupHideTimer = window.setTimeout(() => { this.licensePopupEl.classList.remove("open"); this.popupHideTimer = null; }, 180);
    };
    [this.licenseBadgeEl, this.licensePopupEl].forEach(el => {
      el.addEventListener("mouseenter", openPopup);
      el.addEventListener("mouseleave", closePopup);
    });
    this.licenseBadgeEl.addEventListener("focus", openPopup);
    this.licenseBadgeEl.addEventListener("blur", closePopup);

    // Faint product name, bottom-left, only while no valid license is active.
    this.watermarkEl = document.createElement("div");
    this.watermarkEl.className = "sop-watermark";
    this.watermarkEl.textContent = APP_INFO.displayName;
    this.target.appendChild(this.watermarkEl);

    this.licenseOverlayEl = document.createElement("div");
    this.licenseOverlayEl.className = "sop-license-overlay";
    this.target.appendChild(this.licenseOverlayEl);

    // Power BI only calls update() on data/filter/resize/interaction changes — nothing about
    // the passage of time alone triggers it. Without this, a trial that expires (or a paid
    // license that lapses) while the report just sits open on screen would never actually be
    // re-evaluated until something else happened to fire an update(). This timer re-checks the
    // license on its own once a minute and, if the valid<->invalid state flips, re-renders so
    // the lock/restriction takes effect (or lifts) without needing an external nudge.
    this.selfCheckIntervalId = window.setInterval(() => this.performSelfCheck(), SELF_CHECK_INTERVAL_MS);
  }

  /** Frees the self-check timer if the host tears this instance down. */
  public destroy(): void {
    if (this.selfCheckIntervalId !== null) {
      window.clearInterval(this.selfCheckIntervalId);
      this.selfCheckIntervalId = null;
    }
    if (this.licenseDebounceId !== null) {
      window.clearTimeout(this.licenseDebounceId);
      this.licenseDebounceId = null;
    }
    this.licenseDebounceBurstStart = null;
    if (this.popupHideTimer !== null) { window.clearTimeout(this.popupHideTimer); this.popupHideTimer = null; }
  }

  private performSelfCheck(): void {
    // Force a fresh license re-evaluation on the next refreshLicense() call by clearing the
    // memoized inputs signature (otherwise the throttle guard would skip it), then run it.
    this.lastLicenseInputs = "\u0000force-recheck";
    this.refreshLicense({ host: this.host, dataView: this.lastDataView });
  }

  public update(options: VisualUpdateOptions): void {
    // Wraps the ENTIRE update body — not just parseData/render — because
    // populateFormattingSettingsModel() and refreshLicense() can also throw on a transient/
    // incomplete DataView (e.g. mid-way through dragging fields into the well), and an
    // uncaught exception ANYWHERE in update() is what leaves Power BI's editor stuck/
    // unresponsive to further field changes. A previous fix only wrapped part of this
    // function, which is why the symptom kept coming back.
    try {
      this.updateInternal(options);
    } catch (err) {
      console.error("Smart Org Pro: update() failed, showing an empty chart instead of leaving the visual stuck.", err);
      this.nodes = [];
      this.nodesById = {};
      this.childrenMap = {};
      this.roots = [];
      try {
        if (options.viewport) this.render(options.viewport);
      } catch {
        // Nothing more we can safely do — but we've avoided leaving stale/partial DOM state.
      }
    }
  }

  private updateInternal(options: VisualUpdateOptions): void {
    const dataView: DataView = options.dataViews && options.dataViews[0];
    this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
      VisualFormattingSettingsModel, dataView
    );
    this.lastViewport = options.viewport;
    this.lastDataView = dataView;

    const restricted = !this.licenseState.valid;
    this.target.classList.toggle("sop-restricted", restricted);
    this.applyTheme(restricted ? "darkNeon" : (this.formattingSettings.themeCard.theme.value.value as string));

    // Guards against any single bad/incomplete DataView (e.g. only some fields bound so far,
    // or a Power BI intermediate update mid-drag) taking down the WHOLE visual with an
    // uncaught exception — which can leave the report editor stuck/unresponsive to further
    // field changes. Parsing/rendering failures now degrade to an empty chart instead.
    try {
      this.parseData(dataView);
      this.restoreFilterState(options, dataView);
      this.computeDepartmentColors(dataView);
      this.render(options.viewport);
    } catch (err) {
      this.nodes = [];
      this.nodesById = {};
      this.childrenMap = {};
      this.roots = [];
      console.error("Smart Org Pro: render failed, showing an empty chart instead of crashing.", err);
      try {
        this.render(options.viewport);
      } catch {
        // If even an empty-data render throws, there's nothing more we can safely do here —
        // but we've at least avoided leaving stale/partial DOM state from the failed attempt.
      }
    }

    if (this.hintEl) this.hintEl.style.display = this.nodes.length ? "none" : "flex";
    this.refreshLicense({ host: this.host, dataView });
  }

  private refreshLicense(storageCtx: StorageCtx): void {
    const activationKey = this.formattingSettings.licenseCard.activationKey.value;
    const card = this.formattingSettings.licenseCard;
    const wasValid = this.licenseState.valid;

    // Always reflect the CURRENT known license state in the Format pane, on every refresh —
    // this runs before the throttle early-return below, so the Status field stays populated
    // even on the (common) updates where we skip the async re-check.
    card.displayName = licenseCardLabel(this.licenseState);
    card.status.value = licenseCardLabel(this.licenseState);

    // Device code shown on ALL platforms (device lock enforced everywhere)
    this.deviceCode = getDeviceCode();
    card.deviceCode.value = this.deviceCode;

    // Re-check when activation key OR email changes (both are enforced)
    const customerEmail = this.formattingSettings.licenseCard.customerEmail.value;
    const inputsSignature = `${activationKey}\u0000${customerEmail}`;
    if (inputsSignature === this.lastLicenseInputs) {
      return;
    }
    this.lastLicenseInputs = inputsSignature;

    // DEBOUNCED with a max-wait ceiling: typing a license key character-by-character changes
    // activationKey on every keystroke, which changes inputsSignature every time too — without
    // debouncing, that meant one evaluateLicense() call (with its own storage touch) per
    // keystroke. But a PURE debounce (reset the timer on every change, no matter what) has its
    // own failure mode: on a host that calls update() more often than the debounce window for
    // reasons that have nothing to do with typing (observed on Report Server), the timer keeps
    // getting reset and the check never actually runs — which read as "can't enter a license on
    // Report Server at all". The max-wait below guarantees the check fires at least once every
    // LICENSE_MAX_WAIT_MS regardless of how often update() keeps firing.
    const now = Date.now();
    if (this.licenseDebounceBurstStart === null) {
      this.licenseDebounceBurstStart = now;
    }
    const runNow = now - this.licenseDebounceBurstStart >= LICENSE_MAX_WAIT_MS;

    if (this.licenseDebounceId !== null) {
      window.clearTimeout(this.licenseDebounceId);
      this.licenseDebounceId = null;
    }

    const runCheck = () => {
      this.licenseDebounceId = null;
      this.licenseDebounceBurstStart = null;
      evaluateLicense(storageCtx, activationKey, customerEmail, this.deviceCode).then(state => {
        this.licenseState = state;
        card.displayName = licenseCardLabel(state);
        card.status.value = licenseCardLabel(state);
        this.renderLicenseUi();
        // license state changed since the last synchronous render (e.g. the
        // very first check resolving, or a trial/license flipping valid <-> not)
        // -> re-render so restricted mode actually takes effect / lifts.
        if (state.valid !== wasValid && this.lastViewport) {
          const nowRestricted = !state.valid;
          this.target.classList.toggle("sop-restricted", nowRestricted);
          this.applyTheme(nowRestricted ? "darkNeon" : (this.formattingSettings.themeCard.theme.value.value as string));
          this.render(this.lastViewport);
        }
      });
    };

    if (runNow) {
      runCheck();
    } else {
      this.licenseDebounceId = window.setTimeout(runCheck, LICENSE_DEBOUNCE_MS);
    }
  }

  private buildLockIcon(): SVGElement {
    const svg = mkSvg("svg", { viewBox: "0 0 24 24", width: "96", height: "96", fill: "none", stroke: "currentColor", "stroke-width": "1.4" }) as SVGSVGElement;
    svg.appendChild(mkSvg("rect", { x: "4", y: "10.5", width: "16", height: "10.5", rx: "2" }));
    svg.appendChild(mkSvg("path", { d: "M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" }));
    svg.appendChild(mkSvg("circle", { cx: "12", cy: "15.5", r: "1.6", fill: "currentColor", stroke: "none" }));
    svg.appendChild(mkSvg("path", { d: "M12 17.1V19", "stroke-linecap": "round" }));
    return svg;
  }

  private renderLicenseUi(): void {
    const state = this.licenseState;
    const clear = (el: HTMLElement) => { while (el.firstChild) el.removeChild(el.firstChild); };

    // Hide everything first; each case below turns on only what it needs.
    this.licenseOverlayEl.classList.remove("show");
    this.licenseBadgeEl.classList.remove("show");
    this.licensePopupEl.classList.remove("open");
    this.watermarkEl.classList.remove("show");
    this.wrapEl.classList.remove("sop-locked");

    // Valid license (or the very first check still running): nothing to show.
    if (state.valid || state.reason === "checking") return;

    // Watermark while not licensed (switch off with APP_INFO.watermark = false).
    if (APP_INFO.watermark) this.watermarkEl.classList.add("show");

    // No key at all -> Free version: small badge, hover shows what is limited.
    if (state.reason === "no_license") {
      clear(this.licenseBadgeEl);
      this.licenseBadgeEl.appendChild(mkText("span", "sop-badge-text", "Free version - hover for limits"));
      this.licenseBadgeEl.classList.add("show");

      clear(this.licensePopupEl);
      this.licensePopupEl.appendChild(mkText("div", "sop-popup-title", "Free version"));
      this.licensePopupEl.appendChild(mkText("div", "sop-popup-sub", "Requires a license:"));
      const list = mkEl("ul", "sop-popup-list");
      lockedSections(false).forEach(label => list.appendChild(mkText("li", "", label)));
      this.licensePopupEl.appendChild(list);
      this.licensePopupEl.appendChild(
        mkText("div", "sop-popup-foot", "Paste your key in Format pane > License to unlock everything.")
      );
      return;
    }

    // A key was entered but is not usable (expired, wrong device/email, clock change, ...).
    this.wrapEl.classList.add("sop-locked");
    const { title, sub } = licenseOverlayText(state);
    clear(this.licenseOverlayEl);
    const icon = mkEl("div", "sop-license-icon");
    icon.appendChild(this.buildLockIcon());
    this.licenseOverlayEl.appendChild(icon);
    this.licenseOverlayEl.appendChild(mkText("div", "sop-license-title", title));
    this.licenseOverlayEl.appendChild(mkText("div", "sop-license-sub", sub));
    this.licenseOverlayEl.classList.add("show");
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  /** Min/max zoom as multipliers, read from the Format pane and sanity-clamped so a
   *  nonsensical entry (max below min, 0, a negative) can't wedge the visual. */
  private zoomLimits(): { min: number; max: number } {
    const card = this.formattingSettings.zoomCard;
    let min = (Number(card.minZoom.value) || 30) / 100;
    let max = (Number(card.maxZoom.value) || 300) / 100;
    min = Math.max(0.1, Math.min(min, 5));
    max = Math.max(0.1, Math.min(max, 5));
    if (max < min) { const t = min; min = max; max = t; }
    return { min, max };
  }

  private defaultZoomValue(): number {
    const { min, max } = this.zoomLimits();
    const raw = (Number(this.formattingSettings.zoomCard.defaultZoom.value) || 100) / 100;
    return Math.max(min, Math.min(max, raw));
  }

  /**
   * Sets the zoom level and repaints the transform.
   * `anchor` is a point in .sop-scroll viewport coordinates that should stay visually
   * still (the mouse pointer for wheel zoom) — without it, zooming always drifts toward
   * the top-left corner because transform-origin is 0 0.
   */
  private setZoom(next: number, anchor?: { x: number; y: number }): void {
    const { min, max } = this.zoomLimits();
    const clamped = Math.max(min, Math.min(max, next));
    if (Math.abs(clamped - this.zoom) < 0.0005) return;

    const prev = this.zoom;
    this.zoom = clamped;
    this.applyZoomTransform();

    if (anchor) {
      const ratio = clamped / prev;
      this.scrollEl.scrollLeft = (this.scrollEl.scrollLeft + anchor.x) * ratio - anchor.x;
      this.scrollEl.scrollTop = (this.scrollEl.scrollTop + anchor.y) * ratio - anchor.y;
    }
  }

  private applyZoomTransform(): void {
    this.wrapEl.style.transform = `scale(${this.zoom})`;
    this.wrapEl.style.transformOrigin = "0 0";
    // Layout size must be the SCALED size or the scrollbars won't reach the far edge
    // of a zoomed-in chart (a transform is painted, not laid out).
    this.zoomWrapEl.style.width = Math.round(this.stageW * this.zoom) + "px";
    this.zoomWrapEl.style.height = Math.round(this.stageH * this.zoom) + "px";
    this.zoomLabelEl.textContent = Math.round(this.zoom * 100) + "%";
  }

  private onWheel(e: WheelEvent): void {
    if (!this.formattingSettings.zoomCard.enabled.value) return;
    if (!e.ctrlKey && !e.metaKey) return; // plain wheel keeps its normal scroll behaviour
    e.preventDefault();
    const rect = this.scrollEl.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // deltaY is device/host dependent (pixels, lines, pages) — only the sign is reliable,
    // so use a fixed step per notch rather than scaling by the raw delta.
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.setZoom(this.zoom * factor, anchor);
  }

  // ---------------------------------------------------------------------------
  // Cross-filtering via legend
  // ---------------------------------------------------------------------------

  /**
   * Applies or clears a department filter. Clicking the same department again
   * toggles it off to show the full chart again.
   */
  /** Legend click: filter the other visuals by that department (click again to clear). */
  private applyDepartmentFilter(dept: string): void {
    if (this.host.hostCapabilities && this.host.hostCapabilities.allowInteractions === false) return;
    const dep = this.columnTarget("department");
    if (this.colSel.size) this.clearCrossFilters();
    else if (this.currentDeptFilter && this.currentDeptFilter !== dept && dep) {
      this.sendFilter(dep, [], true);
      this.currentDeptFilter = null;
    }
    this.applyDepartmentJsonFilter(dept);
    this.applySelection();
  }

  private applyDepartmentJsonFilter(dept: string): void {
    console.log("applyDepartmentFilter called for dept:", dept, "currentFilter:", this.currentDeptFilter);
    if (!this.lastDataView) {
      console.warn("applyDepartmentFilter: no lastDataView");
      return;
    }
    try {
      // Find the Department column in the dataView.
      const cols = this.lastDataView.table?.columns || [];
      const deptCol = cols.find(c => c.roles && c.roles["department"]);
      if (!deptCol) {
        console.warn("applyDepartmentFilter: no department column found");
        return;
      }

      // queryName is normally "TableName.ColumnName" — split on the FIRST dot only,
      // since a table name itself could theoretically contain one. Falling back to
      // displayName (as before) pointed the filter at a "column" and "table" that
      // usually don't match the model's real names, which is why filtering silently
      // did nothing.
      let tableName = "";
      let columnName = deptCol.displayName || "Department";
      const qn = deptCol.queryName || "";
      console.log("deptCol.queryName:", qn);
      const dot = qn.indexOf(".");
      if (dot > 0) {
        tableName = qn.slice(0, dot);
        columnName = qn.slice(dot + 1);
      }
      if (!tableName) {
        console.warn("Cross-filter: couldn't resolve the Department column's table name from queryName:", qn);
        console.warn("Falling back to displayName:", deptCol.displayName);
        tableName = deptCol.displayName || "Table";
      }
      console.log("Filter target: table=" + tableName + ", column=" + columnName);

      // Toggle: if this department is already filtered, clear the filter.
      if (this.currentDeptFilter === dept) {
        // Clearing requires a valid IFilter + FilterAction.remove — passing
        // null/undefined (an earlier version of this code did) isn't a valid
        // call shape and silently did nothing, which is why "click again to
        // clear" never worked.
        const clearFilter = {
          $schema: "https://powerbi.com/product/schema#basic",
          filterType: 1,
          target: { table: tableName, column: columnName },
          operator: "In",
          values: [] as string[]
        };
        console.log("Applying REMOVE filter:", clearFilter);
        this.host.applyJsonFilter(clearFilter, "general", "filter", powerbi.FilterAction.remove);
        this.currentDeptFilter = null;
        console.log("Filter cleared");
      } else {
        // Build a basic filter object. The exact format depends on the column type,
        // but a simple "In" operator works for string values.
        const filter = {
          $schema: "https://powerbi.com/product/schema#basic",
          filterType: 1,
          target: {
            table: tableName,
            column: columnName
          },
          operator: "In",
          values: [dept]
        };
        console.log("Applying MERGE filter:", filter);
        this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
        this.currentDeptFilter = dept;
        console.log("Filter applied for dept:", dept);
      }
    } catch (err) {
      console.error("Cross-filter error:", err);
      throw err; // Re-throw so the user can see it in the console
    }
  }

  private currentDeptFilter: string | null = null;

  /**
   * Draws the department color key and reserves room for it by insetting the scroll
   * viewport, so the legend never sits on top of the chart.
   */
  private renderLegend(enabled: boolean): void {
    const card = this.formattingSettings.legendCard;
    const position = card.position.value.value as string;
    // Two independent ways to hide it: the on/off switch, or picking "Hidden" as the
    // position — whichever the user reaches for first.
    const show = enabled && card.show.value && position !== "hidden" && this.departmentOrder.length > 0;

    this.legendEl.classList.toggle("show", !!show);
    ["left", "right", "top", "bottom"].forEach(p => this.legendEl.classList.remove("pos-" + p));

    if (!show) {
      this.scrollEl.style.inset = "0";
      this.zoomCtrlEl.style.right = "10px";
      this.zoomCtrlEl.style.bottom = "10px";
      return;
    }

    const fontSize = Math.max(7, Math.min(24, Number(card.fontSize.value) || 11));
    const panelW = Math.max(80, Math.min(400, Number(card.panelWidth.value) || 150));
    const textColor = card.textColor.value.value;
    const horizontal = position === "top" || position === "bottom";

    this.legendEl.classList.add("pos-" + position);
    this.legendEl.style.fontSize = fontSize + "px";
    this.legendEl.style.color = textColor;
    this.legendEl.style.width = horizontal ? "" : panelW + "px";

    while (this.legendEl.firstChild) this.legendEl.removeChild(this.legendEl.firstChild);

    const titleText = (card.title.value || "").trim();
    if (titleText) this.legendEl.appendChild(mkText("div", "sop-legend-title", titleText));

    const items = mkEl("div", "sop-legend-items");
    this.departmentOrder.forEach(dept => {
      const row = mkEl("div", "sop-legend-item");
      row.style.cursor = "pointer";
      row.title = dept + " (click to filter)";
      const dot = mkEl("span", "sop-legend-dot");
      dot.style.background = this.departmentColors[dept] || "var(--text-2)";
      row.appendChild(dot);
      row.appendChild(mkText("span", "sop-legend-label", dept));
      
      // Cross-filtering: clicking the department color filters the chart to show only that dept
      row.addEventListener("click", () => this.applyDepartmentFilter(dept));
      
      items.appendChild(row);
    });
    this.legendEl.appendChild(items);

    // Reserve the space. For top/bottom the height isn't known until it's in the DOM,
    // so measure it back rather than guessing a fixed strip height.
    const thickness = horizontal
      ? Math.min(this.legendEl.offsetHeight || 40, 160)
      : panelW;
    const inset: Record<string, string> = { top: "0", right: "0", bottom: "0", left: "0" };
    inset[position] = thickness + "px";
    this.scrollEl.style.inset = `${inset.top} ${inset.right} ${inset.bottom} ${inset.left}`;

    // Zoom buttons live in the bottom-right corner — push them inward so a right/bottom
    // legend doesn't cover them.
    this.zoomCtrlEl.style.right = (position === "right" ? thickness + 10 : 10) + "px";
    this.zoomCtrlEl.style.bottom = (position === "bottom" ? thickness + 10 : 10) + "px";
  }
  // ---------------------------------------------------------------------------
  // Data card (always-visible numbers under each person)
  // ---------------------------------------------------------------------------

  /** Manual per-slot target from the Format pane, in value-field drop order.
   *  0 means "no manual override" — fall back to the target measure, if any. */
  private manualTarget(slot: number): number {
    const c = this.formattingSettings.kpiPerfCard;
    const slices = [c.target1, c.target2, c.target3, c.target4];
    if (slot < 0 || slot >= slices.length) return 0;
    const v = Number(slices[slot].value);
    return isFinite(v) && v > 0 ? v : 0;
  }

  /**
   * Renames the 8 "KPI n" visibility/direction slots AND the 4 manual-target slots in
   * the Format pane to the actual bound measure names, e.g. "KPI 1 (unused)" becomes
   * "Sales". Same pattern already used for this project's 8 department-color slots —
   * a fixed pool of controls that relabels itself, since the Format pane can't
   * generate a truly dynamic (1-per-bound-measure) set of controls. Measures beyond
   * the 8th slot have no visibility/direction control and are always shown as
   * "Higher is better"; measures beyond the 4th have no manual-target override and
   * can only get a target from the "Data card targets" measure.
   *
   * Every label below puts the MEASURE NAME FIRST, then a short, consistent
   * instruction — so even if the Format pane's narrow column truncates the end of a
   * long label, the one thing that matters (which measure this is) is still visible,
   * and the three related controls for the same measure (show / target / direction)
   * read as obviously related when scanned as a flat list.
   */
  private renameKpiSlots(): void {
    const c = this.formattingSettings.kpiPerfCard;
    const visSlices = [c.kpiVis1, c.kpiVis2, c.kpiVis3, c.kpiVis4, c.kpiVis5, c.kpiVis6, c.kpiVis7, c.kpiVis8];
    const dirSlices = [c.kpiDir1, c.kpiDir2, c.kpiDir3, c.kpiDir4, c.kpiDir5, c.kpiDir6, c.kpiDir7, c.kpiDir8];
    const targetSlices = [c.target1, c.target2, c.target3, c.target4];
    // Names come from whichever node has the most stats bound — normally every node
    // has the same set, but this is defensive against a sparse/inconsistent model.
    let names: string[] = [];
    this.nodes.forEach(n => {
      if (n.statMeasureNames.length > names.length) names = n.statMeasureNames.map(m => cleanKpiLabel(m.stat));
    });
    for (let i = 0; i < 8; i++) {
      const label = names[i];
      visSlices[i].displayName = label ? `Show "${label}"` : `KPI slot ${i + 1} (not used by your data)`;
      dirSlices[i].displayName = label ? `"${label}" — lower value is better` : `KPI slot ${i + 1} direction (not used)`;
    }
    for (let i = 0; i < 4; i++) {
      const label = names[i];
      targetSlices[i].displayName = label
        ? `"${label}" — manual target override (0 = use the Target measure)`
        : `KPI slot ${i + 1} manual target (not used)`;
    }
  }

  /** Whether the KPI at this slot (0-based, drop order) should be shown at all.
   *  Beyond the 8 controllable slots, always visible — there's no control for it. */
  private kpiVisible(slot: number): boolean {
    const c = this.formattingSettings.kpiPerfCard;
    const slices = [c.kpiVis1, c.kpiVis2, c.kpiVis3, c.kpiVis4, c.kpiVis5, c.kpiVis6, c.kpiVis7, c.kpiVis8];
    if (slot < 0 || slot >= slices.length) return true;
    return !!slices[slot].value;
  }

  /** Whether a lower raw value is better for this KPI slot (e.g. Cost, Discount-as-
   *  spend). Beyond the 8 controllable slots, defaults to "higher is better". */
  private kpiHigherIsBetter(slot: number): boolean {
    const c = this.formattingSettings.kpiPerfCard;
    const slices = [c.kpiDir1, c.kpiDir2, c.kpiDir3, c.kpiDir4, c.kpiDir5, c.kpiDir6, c.kpiDir7, c.kpiDir8];
    if (slot < 0 || slot >= slices.length) return true;
    // ToggleSwitch: true means "Lower is better" per the field's label.
    return !slices[slot].value;
  }

  /** Achievement against an EXPLICIT target only (measure or manual). Null when there
   *  is no explicit target — this is what decides whether "/ target" and the target
   *  marker make sense to show at all, as opposed to the auto peer-comparison fallback. */
  private explicitAchievementOf(s: OrgStat): number | null {
    if (s.target === null || s.target === 0 || !isFinite(s.target)) return null;
    return (s.raw / s.target) * 100;
  }

  /**
   * Achievement as a percentage for bar/color purposes: explicit target if there is
   * one, otherwise this stat's value relative to the highest value for the same field
   * among all people on the chart (OrgStat.relativeMax). This is what makes a progress
   * bar show up even when the user hasn't configured any target at all. Null only when
   * there's truly nothing to compare against (every node has 0 for this stat).
   */
  private achievementOf(s: OrgStat): number | null {
    const explicit = this.explicitAchievementOf(s);
    if (explicit !== null) return explicit;
    if (s.relativeMax === null || s.relativeMax === 0) return null;
    return (s.raw / s.relativeMax) * 100;
  }

  /** True when achievementOf() is backed by a real, user-set target rather than the
   *  auto peer-max fallback — controls whether "/ target" and the target marker make
   *  sense to show at all. */
  private hasExplicitTarget(s: OrgStat): boolean {
    return this.explicitAchievementOf(s) !== null;
  }

  /**
   * Threshold-based (not gradient) conditional formatting, per the spec: green at or
   * above the green threshold, yellow at or above the yellow threshold, red below that.
   * For a "lower is better" KPI the comparison flips around 100 — mirroring the
   * achievement percentage (100 - (ach - 100) = 200 - ach) means "used half of target"
   * (ach=50, great for a cost) scores as if it were 150 on the higher-is-better scale,
   * and "used double the target" (ach=200, bad) scores as if it were 0 — same thresholds
   * apply unchanged either way.
   */
  private kpiStatus(achievement: number, higherIsBetter: boolean): { color: string; label: string } {
    const c = this.formattingSettings.kpiPerfCard;
    const green = Number(c.greenThreshold.value);
    const yellow = Number(c.yellowThreshold.value);
    const effective = higherIsBetter ? achievement : (200 - achievement);
    if (effective >= green) return { color: c.colorGreen.value.value, label: "On Target" };
    if (effective >= yellow) return { color: c.colorYellow.value.value, label: "Near Target" };
    return { color: c.colorRed.value.value, label: "Below Target" };
  }

  /** The color a single value/bar should be drawn in. Neutral value color when there's
   *  nothing at all to compare against (no target AND no peer data). */
  private statColor(s: OrgStat, slot: number): string {
    const c = this.formattingSettings.kpiPerfCard;
    const ach = this.achievementOf(s);
    if (ach === null) return c.valueColor.value.value;
    return this.kpiStatus(ach, this.kpiHigherIsBetter(slot)).color;
  }

  /**
   * One progress bar for the EXPANDED state, in one of 5 styles, each showing the
   * actual fill AND a distinct target marker — never just "fill to X%" with nothing
   * to compare it against, per the spec's explicit requirement.
   *
   * The bar's own scale is built from the RAW numbers (actual, target, and the peer
   * group's highest value for this same field), not from the achievement PERCENTAGE.
   * An earlier version scaled purely off achievement% with a fixed-130 floor — since
   * achievement was normalized so the target always sits at exactly 100 on that scale,
   * and the floor dominated for the whole 0-113% range where nearly all real KPIs land,
   * the marker ended up sitting at the same ~77% position on almost every row (reported
   * as "the target line is always in the same place"). Scaling on the raw numbers
   * instead means the marker's position reflects how this KPI's actual target compares
   * to the peer group's spread — genuinely different from row to row.
   */
  private buildKpiProgressBar(s: OrgStat, color: string, style: string, height: number): HTMLElement {
    const target = this.hasExplicitTarget(s) ? (s.target as number) : null;
    // What the bar is measured AGAINST: the real target when there is one, otherwise
    // the highest value anyone on the chart has for this same field (peer-comparison
    // fallback, so a bar still means something even with no target configured at all).
    //
    // This used to ALWAYS blend the chart-wide peer max into the scale even when a real
    // target existed — so one person with a much bigger number for the same field
    // squeezed everyone else's bar down to a barely-visible sliver, EVEN AT 100%
    // achievement (reported: "Actual 313M / Target 314M / 100%" rendering as a tiny
    // fill). The scale must come from THIS row's own actual/target relationship only;
    // the peer max is relevant ONLY as a last resort when there's no target at all.
    const comparisonValue = target !== null ? target : s.relativeMax;
    const hasComparison = comparisonValue !== null && comparisonValue !== 0;
    const scaleBasis = hasComparison
      ? Math.max(Math.abs(s.raw), Math.abs(comparisonValue as number), 1)
      : Math.max(Math.abs(s.raw), 1);
    const scaleMax = scaleBasis * 1.15;
    const fillPct = Math.max(0, Math.min(100, (Math.max(0, s.raw) / scaleMax) * 100));
    const markerPct = (target !== null) ? Math.max(0, Math.min(100, (Math.abs(target) / scaleMax) * 100)) : null;

    if (style === "segmented") {
      // Segmented: 10 blocks, filled against the same per-row scale so the target still
      // lands on a visible segment boundary.
      const wrap = mkEl("div", "sop-kp-bar sop-kpbar-segmented");
      wrap.style.height = height + "px";
      const filled = Math.round((fillPct / 100) * 10);
      const targetSeg = markerPct !== null ? Math.round((markerPct / 100) * 10) : -1;
      for (let i = 0; i < 10; i++) {
        const seg = mkEl("span", i < filled ? "on" : "");
        if (i < filled) seg.style.background = color;
        if (i === targetSeg) seg.classList.add("target-seg");
        wrap.appendChild(seg);
      }
      return wrap;
    }

    // Classic, Target Marker, and Gradient share the same track/marker/fill DOM shape —
    // they differ only in the fill's own look, which is pure CSS keyed off the class.
    const styleClass = style === "gradient" ? "sop-kpbar-gradient" : (style === "marker" ? "sop-kpbar-marker" : "sop-kpbar-classic");
    const track = mkEl("div", `sop-kp-bar ${styleClass}`);
    track.style.height = height + "px";
    const fill = mkEl("span", "fill");
    fill.style.width = fillPct + "%";
    fill.style.background = style === "gradient" ? `linear-gradient(90deg, ${darken(color, 0.35)}, ${color})` : color;
    track.appendChild(fill);
    if (markerPct !== null) {
      const marker = mkEl("span", "target-marker");
      marker.style.left = markerPct + "%";
      track.appendChild(marker);
    }
    return track;
  }

  /**
   * Detailed hover tooltip for one expanded KPI row, in one of 5 styles. All 5 show the
   * same fields (Actual, Target, Achievement, Gap, Previous, Growth, Status) — only the
   * visual presentation differs, per the spec. Previous/Growth are omitted entirely when
   * no "Data card previous period" measure is bound for this slot (there's nothing
   * honest to show otherwise).
   */
  private buildKpiTooltip(s: OrgStat, cleanName: string, slot: number, decimals: number, compact: boolean): HTMLElement {
    const c = this.formattingSettings.kpiPerfCard;
    const ach = this.achievementOf(s);
    const higherIsBetter = this.kpiHigherIsBetter(slot);
    const status = ach !== null ? this.kpiStatus(ach, higherIsBetter) : { color: "var(--text-1)", label: "No comparison" };
    const style = pickByName(TOOLTIP_STYLE_NAMES, c.tooltipStyle.value);

    const rows: Array<[string, string, string?]> = [];
    rows.push(["Actual", formatStat(s.raw, decimals, compact)]);
    if (s.target !== null) rows.push(["Target", formatStat(s.target, decimals, compact)]);
    if (ach !== null) rows.push(["Achievement", formatAchievementPct(ach)]);
    if (s.target !== null) {
      const gap = s.raw - s.target;
      rows.push(["Gap", (gap >= 0 ? "+" : "") + formatStat(gap, decimals, compact)]);
    }
    if (s.previous !== null) {
      rows.push(["Previous", formatStat(s.previous, decimals, compact)]);
      if (s.previous !== 0) {
        const growth = ((s.raw - s.previous) / Math.abs(s.previous)) * 100;
        rows.push(["Growth", (growth >= 0 ? "+" : "") + growth.toFixed(1) + "%"]);
      }
    }
    if (ach !== null) rows.push(["Status", status.label, status.color]);

    const tip = mkEl("div", `sop-kp-tooltip tip-${style}`);
    tip.style.setProperty("--tip-accent", status.color);

    // User-configurable overrides — applied as inline styles so they win over each
    // tooltip style's own CSS colors/size ("overrides the style's own" per the field's
    // own label). Applied to the container (background/font-size) and directly to each
    // row's label/value (not just inherited), since a couple of styles set their own
    // color on those specific elements in CSS and inheritance alone wouldn't beat that.
    const tooltipBg = c.tooltipBackground.value.value;
    const tooltipText = c.tooltipTextColor.value.value;
    const tooltipFs = Math.max(8, Math.min(20, Number(c.tooltipFontSize.value) || 11));
    tip.style.background = tooltipBg;
    tip.style.color = tooltipText;
    tip.style.fontSize = tooltipFs + "px";

    const head = mkText("div", "tip-head", cleanName.toUpperCase() + (style === "executive" ? " PERFORMANCE" : ""));
    tip.appendChild(head);

    const body = mkEl("div", "tip-body");
    rows.forEach(([label, value, color]) => {
      const row = mkEl("div", "tip-row");
      const labelEl = mkText("span", "tip-label", label);
      labelEl.style.color = tooltipText;
      labelEl.style.opacity = "0.75";
      row.appendChild(labelEl);
      const valEl = mkText("span", "tip-value", value);
      valEl.style.color = color || tooltipText;
      row.appendChild(valEl);
      body.appendChild(row);
    });
    tip.appendChild(body);

    return tip;
  }

  /** Height of the collapsed KPI area (name + value rows only, no bars). */
  private computeKpiCollapsedHeight(visibleCount: number): number {
    if (visibleCount <= 0) return 0;
    const c = this.formattingSettings.kpiPerfCard;
    const fs = Math.max(7, Math.min(20, Number(c.fontSize.value) || 10));
    const rowH = fs * 1.6 + 4;
    return Math.round(visibleCount * rowH + 16);
  }

  /** Height of the expanded KPI area (name/status line + bar + actual/target line per
   *  visible KPI). Must track buildKpiPerfArea()'s expanded branch or nodes overlap. */
  private computeKpiExpandedHeight(visibleCount: number): number {
    if (visibleCount <= 0) return 0;
    const c = this.formattingSettings.kpiPerfCard;
    const fs = Math.max(7, Math.min(20, Number(c.fontSize.value) || 10));
    const barH = Math.max(4, Math.min(28, Number(c.progressHeight.value) || 8));
    const rowH = fs * 1.4 /* name+status line */ + 6 /* gap */ + barH + 6 /* gap */ + fs * 1.15 /* actual/target line */ + 10;
    return Math.round(visibleCount * rowH + 18);
  }

  /**
   * The full KPI Performance area for one node — collapsed (compact name/value list,
   * conditionally colored, no bars) or expanded (per-KPI progress with target marker,
   * hover tooltip), per whether this node's id is in expandedKpiIds. Clicking anywhere
   * in the area toggles between the two for THIS node only.
   */
  private buildKpiPerfArea(n: OrgNode, accent: string, viewport: IViewport): HTMLElement {
    const c = this.formattingSettings.kpiPerfCard;
    const fs = Math.max(7, Math.min(20, Number(c.fontSize.value) || 10));
    const containerStyle = pickByName(DC_STYLE_NAMES, c.containerStyle.value);
    const decimals = Number(c.decimals.value) || 0;
    const compact = !!c.compact.value;
    const radius = Math.max(0, Math.min(28, Number(c.cornerRadius.value) || 0));
    const opacity = Math.max(10, Math.min(100, Number(c.opacity.value) || 100)) / 100;
    const bg = resolveThemeColor(c.background.value.value, "#161b26", "var(--card)");
    const labelColorResolved = resolveThemeColor(c.labelColor.value.value, "#8b93a7", "var(--text-1)");
    const valueColorResolved = resolveThemeColor(c.valueColor.value.value, "#eef1f7", "var(--text-0)");
    const barHeight = Math.max(4, Math.min(28, Number(c.progressHeight.value) || 8));
    const progressStyle = pickByName(PROGRESS_STYLE_NAMES, c.progressStyle.value);
    const tooltipOn = !!c.tooltipEnabled.value;
    const isExpanded = this.expandedKpiIds.has(n.id);

    // Visible stats only, but keep each one's true slot index (for kpiVisible/
    // kpiHigherIsBetter/manual target, which are all indexed by ORIGINAL drop order,
    // not position within the filtered list).
    const visible = n.stats
      .map((s, slot) => ({ s, slot }))
      .filter(({ slot }) => this.kpiVisible(slot));

    const wrap = mkEl("div", `sop-kpiperf st-${containerStyle}${isExpanded ? " expanded" : " collapsed"}`);
    wrap.style.fontSize = fs + "px";
    wrap.style.borderRadius = radius + "px";
    wrap.style.opacity = String(opacity);
    wrap.style.setProperty("--dc-accent", accent);
    wrap.style.setProperty("--dc-bg", bg);
    // The node's own element gets a fixed height equal to THIS node's own current KPI
    // area height (collapsed or expanded, from kpiHeightById — computed once per
    // render in render(), see its own comment for why a single global number was the
    // root cause of a real bug: it silently stayed in three places after the layout
    // math was fixed to be per-node, so a collapsed card's rendered box kept getting
    // forced to the size of whichever OTHER node happened to be expanded, which is
    // what broke the "default" (collapsed) cards the moment any one card was opened.
    wrap.style.minHeight = (this.kpiHeightById[n.id] || 0) + "px";
    wrap.style.boxSizing = "border-box";

    switch (containerStyle) {
      case "gradient": wrap.style.background = `linear-gradient(160deg, ${accent}, ${darken(bg, 0.15)})`; break;
      case "outline": wrap.style.background = "transparent"; wrap.style.borderColor = accent; break;
      case "solid": wrap.style.background = darken(bg, 0.35); break;
      case "neon":
        wrap.style.background = bg;
        wrap.style.borderColor = accent;
        wrap.style.boxShadow = `0 0 0 1px ${accent}, 0 0 14px -2px ${accent}, 0 10px 22px -12px var(--shadow)`;
        break;
      case "sidebar": wrap.style.background = bg; wrap.style.borderLeftColor = accent; break;
      default: wrap.style.background = bg;
    }
    if (containerStyle !== "outline" && containerStyle !== "sidebar" && containerStyle !== "neon") {
      wrap.style.borderTopColor = accent;
      wrap.classList.add("has-accent-edge");
    }

    // Subtle connector notch tying this area to the card above it — same idea as the
    // old data card's tooltip arrow, kept because the spec explicitly asks for a clear
    // visual link back to the employee/manager card.
    const arrow = mkEl("div", "sop-kp-arrow");
    arrow.style.background = containerStyle === "gradient" ? accent : (containerStyle === "solid" ? darken(bg, 0.35) : bg);
    if (containerStyle === "outline") { arrow.style.background = "transparent"; arrow.style.borderColor = accent; }
    wrap.appendChild(arrow);

    // Visible expand/collapse affordance — without this, nothing on screen indicated
    // the area was clickable at all or which state it was in (a real usability gap
    // flagged after the click-to-expand behavior shipped with no visual cue for it,
    // unlike the existing +/- hierarchy toggle it otherwise mirrors).
    const chevron = mkText("div", "sop-kp-chevron", isExpanded ? "\u25B4" : "\u25BE"); // ▴ / ▾
    chevron.title = isExpanded ? "Click to collapse" : "Click to expand";
    wrap.appendChild(chevron);

    const body = mkEl("div", "sop-kp-body");
    wrap.appendChild(body);

    if (!isExpanded) {
      // Collapsed: name + value only, conditionally colored. No bars, no targets shown
      // inline — exactly the compact default state the spec asks for.
      visible.forEach(({ s, slot }) => {
        const idx = n.stats.indexOf(s);
        const measureNames = idx < n.statMeasureNames.length ? n.statMeasureNames[idx] : { stat: s.label, target: null };
        const cleanName = cleanKpiLabel(measureNames.stat);
        const ach = this.achievementOf(s);
        const color = this.statColor(s, slot);

        const row = mkEl("div", "sop-kp-row-collapsed");
        const nameEl = mkText("span", "kp-name", cleanName);
        nameEl.style.color = labelColorResolved;
        row.appendChild(nameEl);
        const val = mkText("span", "kp-value", formatStat(s.raw, decimals, compact));
        val.style.color = color;
        row.appendChild(val);
        row.title = ach !== null
          ? `${cleanName}: ${s.raw.toLocaleString("en-US")} (${Math.round(ach)}%)`
          : `${cleanName}: ${s.raw.toLocaleString("en-US")}`;
        body.appendChild(row);
      });
    } else {
      // Expanded: full progress per KPI, with hover tooltip.
      visible.forEach(({ s, slot }) => {
        const idx = n.stats.indexOf(s);
        const measureNames = idx < n.statMeasureNames.length ? n.statMeasureNames[idx] : { stat: s.label, target: null };
        const cleanName = cleanKpiLabel(measureNames.stat);
        const ach = this.achievementOf(s);
        const higherIsBetter = this.kpiHigherIsBetter(slot);
        const status = ach !== null ? this.kpiStatus(ach, higherIsBetter) : { color: valueColorResolved, label: "" };

        const row = mkEl("div", "sop-kp-row-expanded");

        const head = mkEl("div", "kp-row-head");
        const nameEl = mkText("span", "kp-name", cleanName);
        nameEl.style.color = labelColorResolved;
        head.appendChild(nameEl);
        const achWrap = mkEl("span", "kp-ach-wrap");
        if (ach !== null) {
          const dot = mkEl("span", "kp-dot");
          dot.style.background = status.color;
          achWrap.appendChild(dot);
          achWrap.appendChild(mkText("span", "kp-ach", formatAchievementPct(ach)));
          (achWrap as HTMLElement).style.color = status.color;
        }
        head.appendChild(achWrap);
        row.appendChild(head);

        if (ach !== null) {
          row.appendChild(this.buildKpiProgressBar(s, status.color, progressStyle, barHeight));
        } else {
          // Nothing to compare against at all — still render an (empty, unfilled) bar
          // so every row keeps the same height/shape.
          row.appendChild(this.buildKpiProgressBar(s, valueColorResolved, progressStyle, barHeight));
        }

        const foot = mkEl("div", "kp-row-foot");
        foot.style.color = labelColorResolved;
        foot.appendChild(mkText("span", "", "Actual: " + formatStat(s.raw, decimals, compact)));
        if (s.target !== null) {
          foot.appendChild(mkText("span", "", "Target: " + formatStat(s.target, decimals, compact)));
        }
        row.appendChild(foot);

        if (tooltipOn) {
          const tip = this.buildKpiTooltip(s, cleanName, slot, decimals, compact);
          row.appendChild(tip);
          // Edge-aware flip, same idea as the employee hover panel: a KPI row near the
          // right/bottom of the stage would otherwise have its tooltip clipped.
          row.addEventListener("mouseenter", () => {
            const rowRect = row.getBoundingClientRect();
            const stageRect = this.scrollEl.getBoundingClientRect();
            tip.classList.toggle("flip-x", rowRect.right + 220 > stageRect.right);
            tip.classList.toggle("flip-y", rowRect.bottom + 160 > stageRect.bottom);
          });
        }

        body.appendChild(row);
      });
    }

    // Click anywhere in the area (but not on the tooltip itself, which is hover-only
    // and has no click target) toggles expand/collapse for THIS node only, mirroring
    // the existing collapse/expand-hierarchy click pattern elsewhere in this file.
    wrap.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      if (this.expandedKpiIds.has(n.id)) this.expandedKpiIds.delete(n.id);
      else this.expandedKpiIds.add(n.id);
      this.render(viewport);
    });

    return wrap;
  }



  private computeDepartmentColors(dataView: DataView): void {
    this.departmentColors = {};
    this.departmentOrder = [];
    if (!dataView || !dataView.table || !dataView.table.rows) return;
    const table = dataView.table;
    const idxDept = colIndex(table.columns, "department");
    if (idxDept < 0) return;

    const seen: Record<string, boolean> = {};
    const depts: string[] = [];
    table.rows.forEach(row => {
      const dept = row[idxDept] != null ? String(row[idxDept]) : "";
      if (dept && !seen[dept]) { seen[dept] = true; depts.push(dept); }
    });
    depts.sort();
    this.departmentOrder = depts;

    const card = this.formattingSettings.departmentColorCard;
    const slots = [card.slot1, card.slot2, card.slot3, card.slot4, card.slot5, card.slot6, card.slot7, card.slot8];
    const labelsBySlot: string[][] = slots.map(() => []);

    depts.forEach((dept, idx) => {
      const slotIndex = idx % slots.length;
      this.departmentColors[dept] = slots[slotIndex].value.value;
      labelsBySlot[slotIndex].push(dept);
    });

    slots.forEach((slot, i) => {
      slot.displayName = labelsBySlot[i].length ? labelsBySlot[i].join(", ") : `Color ${i + 1} (unused)`;
    });
  }

  private applyTheme(themeKey: string): void {
    const vars = THEMES[themeKey] || THEMES.darkNeon;
    Object.entries(vars).forEach(([k, v]) => this.target.style.setProperty(k, v));
  }

  private parseData(dataView: DataView): void {
    this.nodes = [];
    this.nodesById = {};
    this.childrenMap = {};
    this.roots = [];

    if (!dataView || !dataView.table || !dataView.table.rows) return;
    const table = dataView.table;
    const cols = table.columns;

    const idxEmp = colIndex(cols, "employeeId");
    const idxMgr = colIndex(cols, "managerId");
    const idxName = colIndex(cols, "name");
    const idxTitle = colIndex(cols, "title");
    const idxDept = colIndex(cols, "department");
    const idxPhoto = colIndex(cols, "photo");
    const idxBadge = colIndex(cols, "badge");
    const idxPerf = colIndex(cols, "performance");
    const kpiIdxs = cols
      .map((c, i) => ({ c, i }))
      .filter(o => o.c.roles && o.c.roles["kpi"])
      .map(o => o.i);
    const statIdxs = cols
      .map((c, i) => ({ c, i }))
      .filter(o => o.c.roles && o.c.roles["stat"])
      .map(o => o.i);
    // Targets pair with value fields BY DROP ORDER: the 1st target measure belongs to
    // the 1st value measure, and so on. A manual target in the Format pane wins over
    // this if it's non-zero (see manualTarget()).
    const targetIdxs = cols
      .map((c, i) => ({ c, i }))
      .filter(o => o.c.roles && o.c.roles["statTarget"])
      .map(o => o.i);
    // Optional — pairs by drop order the same way targets do. Only feeds the KPI
    // tooltip's Previous/Growth rows; everything else ignores it when absent.
    const previousIdxs = cols
      .map((c, i) => ({ c, i }))
      .filter(o => o.c.roles && o.c.roles["statPrevious"])
      .map(o => o.i);

    if (idxEmp < 0) return;

    const byId: Record<string, OrgNode> = {};

    this.nodeSelectionIds = {};
    table.rows.forEach((row, rowIndex) => {
      const id = String(row[idxEmp]);
      const perf = idxPerf >= 0 ? Math.round(Number(row[idxPerf]) || 0) : 0;
      const rawParent = idxMgr >= 0 ? row[idxMgr] : null;
      const parentId = rawParent !== null && rawParent !== undefined && String(rawParent) !== "" ? String(rawParent) : null;

      const node: OrgNode = {
        id,
        rowIndex,
        parentId,
        name: idxName >= 0 && row[idxName] != null ? String(row[idxName]) : id,
        title: idxTitle >= 0 && row[idxTitle] != null ? String(row[idxTitle]) : "",
        department: idxDept >= 0 && row[idxDept] != null ? String(row[idxDept]) : "",
        photo: idxPhoto >= 0 && row[idxPhoto] != null ? String(row[idxPhoto]) : "",
        badge: idxBadge >= 0 && row[idxBadge] ? String(row[idxBadge]) : autoBadge(perf),
        performance: perf,
        kpis: kpiIdxs.map(i => ({ label: cols[i].displayName, value: Math.round(Number(row[i]) || 0) })),
        // Kept unrounded — the data card's decimals/compact settings format it at render time.
        stats: statIdxs.map((i, slot) => {
          const manual = this.manualTarget(slot);
          const fromMeasure = targetIdxs[slot] !== undefined ? Number(row[targetIdxs[slot]]) : NaN;
          let target: number | null = null;
          if (manual > 0) target = manual;
          else if (isFinite(fromMeasure) && fromMeasure !== 0) target = fromMeasure;
          const prevIdx = previousIdxs[slot];
          const prevRaw = prevIdx !== undefined ? Number(row[prevIdx]) : NaN;
          const previous = (prevIdx !== undefined && isFinite(prevRaw)) ? prevRaw : null;
          // relativeMax filled in below, once every node has been parsed and the
          // per-slot max is known.
          return { label: cols[i].displayName, raw: Number(row[i]) || 0, target, relativeMax: null, previous };
        }),
        statMeasureNames: statIdxs.map((i, slot) => ({
          stat: cols[i].displayName,
          target: targetIdxs[slot] !== undefined ? cols[targetIdxs[slot]].displayName : null
        }))
      };
      byId[id] = node;
      this.nodesById[id] = node;
      try {
        this.nodeSelectionIds[id] = this.host.createSelectionIdBuilder()
          .withTable(table, rowIndex)
          .createSelectionId();
      } catch (err) {
        console.warn("Smart Org Pro: could not build a selection id for row", rowIndex, err);
      }
      this.nodes.push(node);
    });

    // Second pass: for every stat SLOT (position in the "Data card values" bucket, not
    // a specific field — different nodes could theoretically differ, though normally
    // they don't), find the highest raw value across all nodes. This is the fallback
    // scale used to draw a progress bar for stats that have no explicit target — see
    // OrgStat.relativeMax's doc comment for why this exists at all.
    const maxBySlot: number[] = [];
    this.nodes.forEach(n => {
      n.stats.forEach((s, slot) => {
        if (s.raw > (maxBySlot[slot] || 0)) maxBySlot[slot] = s.raw;
      });
    });
    this.nodes.forEach(n => {
      n.stats.forEach((s, slot) => {
        const max = maxBySlot[slot];
        s.relativeMax = (max && max > 0) ? max : null;
      });
    });

    this.renameKpiSlots();

    // roots = no parent, or parent not present in the dataset (orphan safety)
    this.nodes.forEach(n => {
      const validParent = n.parentId && byId[n.parentId];
      if (!validParent) {
        this.roots.push(n.id);
      } else {
        (this.childrenMap[n.parentId!] = this.childrenMap[n.parentId!] || []).push(n.id);
      }
    });

    // auto-collapse below a configured level, if set
    const autoLevel = this.formattingSettings.interactionCard.startCollapsedBelowLevel.value;
    if (autoLevel && autoLevel > 0) {
      // visited guards against a cyclic parentId chain in the data (e.g. someone's manager
      // is transitively their own report) — without it, this recurses forever and crashes
      // the visual with a stack overflow on every render that reaches this branch.
      const visited = new Set<string>();
      const walk = (id: string, depth: number) => {
        if (visited.has(id)) return;
        visited.add(id);
        if (depth >= autoLevel) this.collapsedIds.add(id);
        (this.childrenMap[id] || []).forEach(c => walk(c, depth + 1));
      };
      this.roots.forEach(r => walk(r, 0));
    }
  }

  private computeVisible(): Set<string> {
    const visible = new Set<string>();
    const stack = [...this.roots];
    while (stack.length) {
      const id = stack.pop()!;
      if (visible.has(id)) continue; // cycle guard — see the auto-collapse walk() above for why
      visible.add(id);
      if (!this.collapsedIds.has(id)) (this.childrenMap[id] || []).forEach(c => stack.push(c));
    }
    return visible;
  }

  private computeLayout(mode: string, cardW: number, levelGap: number, visible: Set<string>): Record<string, Pt> {
    const slot: Record<string, { x: number; depth: number }> = {};
    let counter = 0;

    // visited guards against a cyclic parentId chain — see the auto-collapse walk() above.
    // A child that's already an ancestor in the current recursion is treated as a leaf
    // (assigned a slot, not recursed into) instead of crashing with a stack overflow.
    const visitedAncestry = new Set<string>();
    const assign = (id: string, depth: number) => {
      if (visitedAncestry.has(id)) {
        slot[id] = { x: counter, depth };
        counter++;
        return;
      }
      visitedAncestry.add(id);
      const kids = (this.childrenMap[id] || []).filter(k => visible.has(k));
      if (kids.length === 0 || this.collapsedIds.has(id)) {
        slot[id] = { x: counter, depth };
        counter++;
      } else {
        kids.forEach(k => assign(k, depth + 1));
        const xs = kids.map(k => slot[k].x);
        slot[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth };
      }
    };
    this.roots.filter(r => visible.has(r)).forEach(r => assign(r, 0));

    const hGap = 26;
    const pos: Record<string, Pt> = {};
    const totalSlots = Math.max(counter, 1);
    const vGapPadding = 40;

    // Vertical/compact mode: each hierarchy LEVEL gets its own vertical gap, sized to
    // the TALLEST node actually at that level right now (base card + that node's own
    // current KPI Performance height) — not one number for the whole chart. This is
    // the fix for a real bug: expanding one person's KPI area used to inflate the gap
    // after EVERY level, including levels with nothing expanded, which is what made
    // still-collapsed cards elsewhere look disconnected from their own toggle buttons.
    // A level with nothing expanded stays exactly as compact as before; only the level
    // that actually contains the expanded node grows to fit it.
    const depthMaxHeight: Record<number, number> = {};
    Object.entries(slot).forEach(([id, s]) => {
      const nodeH = this.cardHeight + (this.kpiHeightById[id] || 0);
      if (!(s.depth in depthMaxHeight) || nodeH > depthMaxHeight[s.depth]) depthMaxHeight[s.depth] = nodeH;
    });
    const maxDepth = Object.keys(depthMaxHeight).length
      ? Math.max(...Object.keys(depthMaxHeight).map(Number))
      : 0;
    const depthGap: Record<number, number> = {};
    for (let d = 0; d <= maxDepth; d++) depthGap[d] = Math.max(levelGap, (depthMaxHeight[d] || this.cardHeight) + vGapPadding);
    const depthY: Record<number, number> = { 0: 0 };
    for (let d = 1; d <= maxDepth; d++) depthY[d] = depthY[d - 1] + depthGap[d - 1];

    // Horizontal and radial modes are unaffected by the reported bug (every screenshot
    // and report so far has been the default vertical tree), so they deliberately keep
    // the OLD, simpler uniform-height approach — the global max across all nodes,
    // exactly what `this.cardHeight` used to already include before this fix — rather
    // than being reworked without a way to visually verify each mode individually.
    const uniformFallbackHeight = this.cardHeight + this.dataCardHeight;
    const effectiveHorizontalDepthGap = Math.max(levelGap, cardW + vGapPadding);

    Object.entries(slot).forEach(([id, s]) => {
      if (mode === "horizontal") {
        pos[id] = { x: s.depth * effectiveHorizontalDepthGap, y: s.x * (cardW + hGap) };
      } else if (mode === "radial") {
        const cx = 560, cy = 320;
        if (s.depth === 0) { pos[id] = { x: cx - cardW / 2, y: cy - uniformFallbackHeight / 2 }; return; }
        const angle = (s.x / totalSlots) * 2 * Math.PI;
        const radius = s.depth * Math.max(levelGap, Math.max(uniformFallbackHeight, cardW) + vGapPadding) * 1.15;
        pos[id] = { x: cx + radius * Math.cos(angle) - cardW / 2, y: cy + radius * Math.sin(angle) - uniformFallbackHeight / 2 };
      } else {
        // vertical + compact
        pos[id] = { x: s.x * (cardW + hGap), y: depthY[s.depth] };
      }
    });
    return pos;
  }

  private perfColor(val: number): string {
    const mode = this.formattingSettings.conditionalFormatCard.mode.value.value as string;
    const cMin = this.formattingSettings.conditionalFormatCard.colorMin.value.value;
    const cMid = this.formattingSettings.conditionalFormatCard.colorMid.value.value;
    const cMax = this.formattingSettings.conditionalFormatCard.colorMax.value.value;
    if (mode === "single") return cMax;
    const t = Math.max(0, Math.min(1, val / 100));
    if (mode === "twoColor") return lerpColor(cMin, cMax, t);
    return t < 0.5 ? lerpColor(cMin, cMid, t / 0.5) : lerpColor(cMid, cMax, (t - 0.5) / 0.5);
  }

  private progressEl(style: string, val: number): HTMLElement {
    const color = this.perfColor(val);
    if (style === "neon") {
      const bar = mkEl("div", "sop-bar sop-neon");
      const span = mkEl("span"); span.style.width = val + "%"; span.style.background = color; span.style.boxShadow = `0 0 10px 1px ${color}`;
      bar.appendChild(span);
      return bar;
    }
    if (style === "liquid") {
      const wrap = mkEl("div", "sop-liquid");
      const fill = mkEl("div", "sop-liquid-fill"); fill.style.height = val + "%"; fill.style.background = color;
      const label = mkText("div", "sop-liquid-label", val + "%");
      wrap.appendChild(fill); wrap.appendChild(label);
      return wrap;
    }
    if (style === "segmented") {
      const wrap = mkEl("div", "sop-segmented");
      const filled = Math.round(val / 10);
      for (let i = 0; i < 10; i++) {
        const seg = mkEl("span", i < filled ? "on" : "");
        if (i < filled) seg.style.background = color;
        wrap.appendChild(seg);
      }
      return wrap;
    }
    if (style === "ring") {
      const R = 26, C = 2 * Math.PI * R, off = C * (1 - val / 100);
      const wrap = mkEl("div", "sop-ring-wrap");
      const svg = mkSvg("svg", { class: "sop-ring", viewBox: "0 0 60 60" });
      svg.appendChild(mkSvg("circle", { cx: "30", cy: "30", r: String(R), stroke: "var(--line)", "stroke-width": "6", fill: "none" }));
      svg.appendChild(mkSvg("circle", {
        cx: "30", cy: "30", r: String(R), stroke: color, "stroke-width": "6", fill: "none",
        "stroke-linecap": "round", "stroke-dasharray": String(C), "stroke-dashoffset": String(off), transform: "rotate(-90 30 30)"
      }));
      const text = mkSvg("text", { x: "30", y: "35", "text-anchor": "middle", "font-size": "13", fill: "var(--text-0)", "font-weight": "700" });
      text.textContent = val + "%";
      svg.appendChild(text);
      wrap.appendChild(svg);
      return wrap;
    }
    const bar = mkEl("div", "sop-bar");
    const span = mkEl("span"); span.style.width = val + "%"; span.style.background = color;
    bar.appendChild(span);
    return bar;
  }

  private connectorEls(p: Pt, c: Pt, style: string, orientation: string, cardW: number, avatarX: number, color: string, thickness: number, parentTotalHeight: number): SVGElement[] {
    let ax: number, ay: number, bx: number, by: number;
    // parentTotalHeight is THIS parent's own base+KPI height (kpiHeightById), not the
    // shared this.cardHeight — otherwise an expanded parent's connector line started
    // partway up its own KPI area (right after the base card) instead of at the box's
    // true bottom edge, visually cutting through/overlapping the parent's own KPI area.
    if (orientation === "h") { ax = p.x + cardW; ay = p.y + parentTotalHeight / 2; bx = c.x; by = c.y + this.cardHeight / 2; }
    else { ax = p.x + avatarX; ay = p.y + parentTotalHeight; bx = c.x + avatarX; by = c.y; }

    if (style === "straight")
      return [mkSvg("line", { x1: String(ax), y1: String(ay), x2: String(bx), y2: String(by), stroke: color, "stroke-width": String(thickness), opacity: "0.55" })];

    if (style === "curved") {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const d = orientation === "h" ? `M${ax},${ay} C ${mx},${ay} ${mx},${by} ${bx},${by}` : `M${ax},${ay} C ${ax},${my} ${bx},${my} ${bx},${by}`;
      return [mkSvg("path", { d, stroke: color, "stroke-width": String(thickness), fill: "none", opacity: "0.55" })];
    }

    const elbow = orientation === "h"
      ? `M${ax},${ay} H${(ax + bx) / 2} V${by} H${bx}`
      : `M${ax},${ay} V${(ay + by) / 2} H${bx} V${by}`;

    if (style === "animatedFlow") {
      const path = mkSvg("path", { d: elbow, stroke: color, "stroke-width": String(thickness), fill: "none", "stroke-dasharray": "4 5", opacity: "0.5" });
      const dot = mkSvg("circle", { r: String(thickness * 2), fill: color });
      const motion = mkSvg("animateMotion", { dur: "2.3s", repeatCount: "indefinite", path: elbow });
      dot.appendChild(motion);
      return [path, dot];
    }

    if (style === "neonGlow") {
      const path = mkSvg("path", { d: elbow, stroke: color, "stroke-width": String(thickness * 1.7), fill: "none", opacity: "0.9" });
      (path as unknown as SVGPathElement).style.filter = `drop-shadow(0 0 6px ${color})`;
      return [path];
    }

    return [mkSvg("path", { d: elbow, stroke: color, "stroke-width": String(thickness), fill: "none", "stroke-dasharray": "4 5", opacity: "0.5" })];
  }

  private relatedIds(id: string | null): Set<string> | null {
    if (!id) return null;
    const byId: Record<string, OrgNode> = {};
    this.nodes.forEach(n => (byId[n.id] = n));
    const related = new Set<string>([id]);
    let cur = byId[id];
    const visitedAncestors = new Set<string>(); // cycle guard — see computeLayout's assign() for why
    while (cur && cur.parentId && byId[cur.parentId] && !visitedAncestors.has(cur.parentId)) {
      visitedAncestors.add(cur.parentId);
      related.add(cur.parentId);
      cur = byId[cur.parentId];
    }
    const stack = [id];
    const pushedForDescendants = new Set<string>([id]);
    while (stack.length) {
      const cid = stack.pop()!;
      (this.childrenMap[cid] || []).forEach(k => {
        if (pushedForDescendants.has(k)) return; // cycle guard
        pushedForDescendants.add(k);
        related.add(k);
        stack.push(k);
      });
    }
    return related;
  }

  private getDepths(): Record<string, number> {
    const depths: Record<string, number> = {};
    const visited = new Set<string>(); // cycle guard — see computeLayout's assign() for why
    const walk = (id: string, d: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      depths[id] = d;
      (this.childrenMap[id] || []).forEach(c => walk(c, d + 1));
    };
    this.roots.forEach(r => walk(r, 0));
    return depths;
  }

  private buildDetailPanel(n: OrgNode, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const panel = mkEl("div", "sop-panel");

    const panelHead = mkEl("div", "sop-panel-head");
    panelHead.appendChild(mkImg(img));
    const headText = mkEl("div");
    headText.appendChild(mkText("div", "sop-nm", n.name));
    headText.appendChild(mkText("div", "sop-rl", n.title));
    panelHead.appendChild(headText);
    panel.appendChild(panelHead);

    const infoGrid = mkEl("div", "sop-info-grid");
    const deptRow = mkEl("div");
    deptRow.appendChild(document.createTextNode("Dept: "));
    deptRow.appendChild(mkText("b", "", n.department));
    const reportsRow = mkEl("div");
    reportsRow.appendChild(document.createTextNode("Reports: "));
    reportsRow.appendChild(mkText("b", "", String(reportsCount)));
    infoGrid.appendChild(deptRow);
    infoGrid.appendChild(reportsRow);
    panel.appendChild(infoGrid);

    const perfRow = mkEl("div", "sop-perf-row");
    perfRow.appendChild(mkText("span", "sop-lbl", "Overall Performance"));
    perfRow.appendChild(mkText("span", "sop-val", n.performance + "%"));
    panel.appendChild(perfRow);

    panel.appendChild(this.progressEl(barStyle, n.performance));

    const kpiMini = mkEl("div", "sop-kpi-mini");
    n.kpis.forEach(k => {
      const row = mkEl("div", "row");
      const labelEl = mkText("span", "kpi-label", cleanKpiLabel(k.label));
      row.appendChild(labelEl);
      const valEl = mkText("span", "kpi-val", k.value + "%");
      valEl.style.color = this.perfColor(k.value);
      row.appendChild(valEl);
      const track = mkEl("div", "track");
      const span = mkEl("span");
      span.style.width = k.value + "%";
      span.style.background = this.perfColor(k.value);
      track.appendChild(span);
      row.appendChild(track);
      kpiMini.appendChild(row);
    });
    panel.appendChild(kpiMini);

    return panel;
  }

  private buildPillCard(n: OrgNode, colorA: string, colorB: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const pill = mkEl("div", "sop-pill");

    const avatar = mkEl("div", "sop-pill-avatar");
    avatar.style.borderColor = colorA;
    avatar.appendChild(mkImg(img));
    pill.appendChild(avatar);

    const info = mkEl("div", "sop-pill-info");
    const top = mkText("div", "sop-pill-top", n.name);
    top.style.background = `linear-gradient(90deg, ${colorA}, ${colorB})`;
    info.appendChild(top);

    const bottom = mkEl("div", "sop-pill-bottom");
    const role = mkText("div", "sop-pill-role", n.title);
    role.style.color = colorA;
    const dept = mkText("div", "sop-pill-dept", n.department);
    bottom.appendChild(role);
    bottom.appendChild(dept);
    info.appendChild(bottom);

    pill.appendChild(info);
    return pill;
  }

  private buildGlassCard(n: OrgNode, barStyle: string, reportsCount: number, accent: string): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-card");
    card.style.borderTop = `3px solid ${accent}`;

    if (n.badge) card.appendChild(mkText("span", "sop-badge", n.badge));

    const avatar = mkEl("div", "sop-avatar");
    avatar.appendChild(mkImg(img));
    card.appendChild(avatar);

    card.appendChild(mkText("div", "sop-name", n.name));
    card.appendChild(mkText("div", "sop-role", n.title));
    card.appendChild(mkText("div", "sop-dept", n.department));

    const miniKpi = mkEl("div", "sop-mini-kpi");
    const miniSpan = mkEl("span"); miniSpan.style.width = n.performance + "%"; miniSpan.style.background = this.perfColor(n.performance);
    miniKpi.appendChild(miniSpan);
    card.appendChild(miniKpi);

    return card;
  }

  private buildMinimalCard(n: OrgNode, accent: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-minimal");
    card.style.borderLeftColor = accent;

    const row = mkEl("div", "sop-minimal-row");
    const photo = mkEl("div", "sop-minimal-photo");
    photo.appendChild(mkImg(img));
    row.appendChild(photo);

    const text = mkEl("div", "sop-minimal-text");
    text.appendChild(mkText("div", "sop-name", n.name));
    text.appendChild(mkText("div", "sop-role", n.title));
    row.appendChild(text);
    card.appendChild(row);

    card.appendChild(mkText("div", "sop-dept", n.department));
    return card;
  }

  private buildRibbonCard(n: OrgNode, accent: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-ribbon-card");

    if (n.title) {
      const ribbon = mkText("div", "sop-ribbon", n.title);
      ribbon.style.background = accent;
      card.appendChild(ribbon);
    }

    const avatar = mkEl("div", "sop-avatar");
    avatar.style.borderColor = accent;
    avatar.appendChild(mkImg(img));
    card.appendChild(avatar);

    card.appendChild(mkText("div", "sop-name", n.name));
    card.appendChild(mkText("div", "sop-dept", n.department));

    return card;
  }

  private buildOutlineCard(n: OrgNode, accent: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-outline");
    card.style.borderColor = accent;

    const avatar = mkEl("div", "sop-outline-avatar");
    avatar.style.borderColor = accent;
    avatar.appendChild(mkImg(img));
    card.appendChild(avatar);

    card.appendChild(mkText("div", "sop-name", n.name));
    const role = mkText("div", "sop-role", n.title);
    role.style.color = accent;
    card.appendChild(role);

    return card;
  }

  private buildPhotoBgCard(n: OrgNode, accent: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-photobg");

    const photo = mkEl("div", "sop-photobg-img");
    photo.style.backgroundImage = `url("${img.replace(/"/g, "")}")`;
    card.appendChild(photo);

    const overlay = mkEl("div", "sop-photobg-overlay");
    overlay.style.background = `linear-gradient(180deg, transparent, ${accent}ee)`;
    overlay.appendChild(mkText("div", "sop-name", n.name));
    overlay.appendChild(mkText("div", "sop-role", n.title));
    card.appendChild(overlay);

    return card;
  }

  private buildNeumorphCard(n: OrgNode, accent: string, barStyle: string, reportsCount: number): HTMLElement {
    const img = n.photo || FALLBACK_AVATAR;
    const card = mkEl("div", "sop-neumorph");

    const avatar = mkEl("div", "sop-neumorph-avatar");
    avatar.appendChild(mkImg(img));
    card.appendChild(avatar);

    card.appendChild(mkText("div", "sop-name", n.name));
    const role = mkText("div", "sop-role", n.title);
    role.style.color = accent;
    card.appendChild(role);
    card.appendChild(mkText("div", "sop-dept", n.department));

    return card;
  }

  private render(viewport: IViewport): void {
    const features = FEATURE_MATRIX[this.licenseState.valid ? this.licenseState.tier : "none"];

    const cardStyle = features.cardStyleChoice ? (this.formattingSettings.cardStyleCard.style.value.value as string) : "glass";
    const pillPalette = PILL_PALETTES[this.formattingSettings.cardStyleCard.pillPalette.value.value as string] || PILL_PALETTES.vibrant;

    // KPI Performance area height is computed PER NODE (its own collapsed/expanded
    // state, its own visible-KPI count) — see kpiHeightById's doc comment above for
    // why a single uniform number was the root cause of a real layout bug. cardHeight
    // stays base-only from here on; dataCardHeight is kept as the global max, used only
    // by layout modes/helpers that intentionally still use a single conservative value.
    const showKpiPerf = features.dataCard && !!this.formattingSettings.kpiPerfCard.enabled.value;
    this.kpiHeightById = {};
    let globalMaxKpiHeight = 0;
    if (showKpiPerf) {
      this.nodes.forEach(n => {
        const visibleCount = n.stats.filter((_s, slot) => this.kpiVisible(slot)).length;
        const h = this.expandedKpiIds.has(n.id)
          ? this.computeKpiExpandedHeight(visibleCount)
          : this.computeKpiCollapsedHeight(visibleCount);
        this.kpiHeightById[n.id] = h;
        if (h > globalMaxKpiHeight) globalMaxKpiHeight = h;
      });
    }
    this.dataCardHeight = globalMaxKpiHeight;
    this.cardHeight = (CARD_STYLE_DEFS[cardStyle] || CARD_STYLE_DEFS.glass).height;

    const layoutKey = features.layoutChoice ? (this.formattingSettings.layoutCard.layout.value.value as string) : "vertical";
    const cardW = cardStyle === "pill" ? Math.max(this.formattingSettings.layoutCard.cardWidth.value, 250) : this.formattingSettings.layoutCard.cardWidth.value;
    const levelGap = this.formattingSettings.layoutCard.levelGap.value;
    const connStyle = features.connectorStyleChoice ? (this.formattingSettings.connectorCard.style.value.value as string) : "elbowDashed";
    const connColor = features.connectorColor ? this.formattingSettings.connectorCard.color.value.value : "#3ba7ff";
    const connThickness = features.connectorColor ? this.formattingSettings.connectorCard.thickness.value : 1.5;
    const barStyle = features.progressBarStyleChoice ? (this.formattingSettings.progressCard.style.value.value as string) : "linear";
    const focusMode = features.focusMode ? this.formattingSettings.interactionCard.focusModeEnabled.value : false;
    const orientation = layoutKey === "horizontal" ? "h" : "v";
    const depths = this.getDepths();

    // Draw the legend first: it insets .sop-scroll, which changes the usable viewport
    // the stage's minimum size is measured against just below.
    this.renderLegend(features.departmentLegend);

    const zoomEnabled = features.zoomControl;
    this.zoomCtrlEl.classList.toggle("show", zoomEnabled && this.formattingSettings.zoomCard.showControls.value);
    // Re-apply "Default zoom (%)" only when that setting itself changed, so a zoom the
    // user set by hand survives every unrelated update() (resize, filter, hover).
    const defaultZoom = this.defaultZoomValue();
    if (this.lastDefaultZoomSetting === null || Math.abs(defaultZoom - this.lastDefaultZoomSetting) > 0.0005) {
      this.lastDefaultZoomSetting = defaultZoom;
      this.zoom = defaultZoom;
    }
    if (!zoomEnabled) this.zoom = 1;

    const visible = this.computeVisible();
    const positions = this.computeLayout(layoutKey, cardW, levelGap, visible);

    // stage size = bounding box of visible nodes. Uses each node's OWN total height
    // (base + its own kpiHeightById), not just the base cardHeight — otherwise an
    // expanded node's taller box could extend past the computed scroll area and get
    // clipped at the bottom instead of being fully scrollable into view.
    let maxX = viewport.width, maxY = viewport.height, minX = 0, minY = 0;
    Object.entries(positions).forEach(([id, p]) => {
      const totalH = this.cardHeight + (this.kpiHeightById[id] || 0);
      maxX = Math.max(maxX, p.x + cardW + 60);
      maxY = Math.max(maxY, p.y + totalH + 60);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    });
    const width = maxX - minX, height = maxY - minY;
    this.stageW = width;
    this.stageH = height;
    this.wrapEl.style.width = width + "px";
    this.wrapEl.style.height = height + "px";
    this.applyZoomTransform();
    this.svgEl.setAttribute("width", String(width));
    this.svgEl.setAttribute("height", String(height));
    this.svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const shift = (p: Pt): Pt => ({ x: p.x - minX, y: p.y - minY });
    const avatarX = (CARD_STYLE_DEFS[cardStyle] || CARD_STYLE_DEFS.glass).avatarCenterX(cardW);

    // connectors
    Array.from(this.svgEl.querySelectorAll("path, line, circle")).forEach(el => el.remove());
    this.nodes.forEach(n => {
      if (!n.parentId || !visible.has(n.parentId) || !visible.has(n.id)) return;
      const parentTotalH = this.cardHeight + (this.kpiHeightById[n.parentId] || 0);
      const els = this.connectorEls(shift(positions[n.parentId]), shift(positions[n.id]), connStyle, orientation, cardW, avatarX, connColor, connThickness, parentTotalH);
      els.forEach(e => this.svgEl.appendChild(e));
    });

    // nodes
    const existing: Record<string, HTMLElement> = {};
    Array.from(this.nodesEl.querySelectorAll<HTMLElement>(".sop-node")).forEach(el => (existing[el.dataset.id!] = el));
    Object.keys(existing).forEach(id => { if (!visible.has(id)) { existing[id].remove(); delete existing[id]; } });

    this.nodes.forEach(n => {
      if (!visible.has(n.id)) return;
      const pos = shift(positions[n.id]);
      let el = existing[n.id];
      if (!el) {
        el = document.createElement("div");
        el.className = "sop-node";
        el.dataset.id = n.id;
        this.nodesEl.appendChild(el);
        el.addEventListener("contextmenu", (e: MouseEvent) => this.onNodeContextMenu(e, el.dataset.id!));
      }
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
      el.style.width = cardW + "px";
      // Total height for THIS node: base card + THIS node's own KPI area height
      // (kpiHeightById, per-node — see render()'s comment). Using the old global
      // dataCardHeight here left the toggle button and next-level connector anchored
      // at the wrong Y for any node whose own KPI height differed from whichever
      // other node happened to be tallest.
      el.style.height = (this.cardHeight + (this.kpiHeightById[n.id] || 0)) + "px";

      const kids = this.childrenMap[n.id] || [];
      const isCollapsed = this.collapsedIds.has(n.id);

      while (el.firstChild) el.removeChild(el.firstChild);

      const accentCycle = ["var(--accent-a)", "var(--accent-b)", "var(--accent-c)", "var(--good)"];
      const accent = features.departmentColors ? (this.departmentColors[n.department] || accentCycle[(depths[n.id] || 0) % accentCycle.length]) : accentCycle[(depths[n.id] || 0) % accentCycle.length];
      const cardSelector: Record<string, string> = {
        glass: ".sop-card", pill: ".sop-pill", minimal: ".sop-minimal",
        ribbon: ".sop-ribbon-card", outline: ".sop-outline", photoBg: ".sop-photobg", neumorph: ".sop-neumorph"
      };

      // The card itself goes in a fixed-height slot so the data card below it always
      // lands at the same place, and so full-bleed styles (photoBg uses height:100%)
      // fill the card area rather than stretching over the data card too. cardHeight
      // is base-card-only now (the KPI area's height is tracked separately, per node,
      // in kpiHeightById) — this used to subtract a global KPI height from it, which
      // went negative (collapsing this slot to nothing) the instant ANY node anywhere
      // was expanded taller than the base card itself.
      const slot = mkEl("div", "sop-cardslot");
      slot.style.height = this.cardHeight + "px";
      el.appendChild(slot);

      let accentForDataCard = accent;

      switch (cardStyle) {
        case "pill": {
          const deptColor = features.departmentColors ? this.departmentColors[n.department] : undefined;
          const [colorA, colorB] = deptColor
            ? [deptColor, darken(deptColor, 0.35)]
            : pillPalette[(depths[n.id] || 0) % pillPalette.length];
          accentForDataCard = colorA;
          slot.appendChild(this.buildPillCard(n, colorA, colorB, barStyle, kids.length));
          break;
        }
        case "minimal": slot.appendChild(this.buildMinimalCard(n, accent, barStyle, kids.length)); break;
        case "ribbon": slot.appendChild(this.buildRibbonCard(n, accent, barStyle, kids.length)); break;
        case "outline": slot.appendChild(this.buildOutlineCard(n, accent, barStyle, kids.length)); break;
        case "photoBg": slot.appendChild(this.buildPhotoBgCard(n, accent, barStyle, kids.length)); break;
        case "neumorph": slot.appendChild(this.buildNeumorphCard(n, accent, barStyle, kids.length)); break;
        default: slot.appendChild(this.buildGlassCard(n, barStyle, kids.length, accent));
      }

      if (showKpiPerf && n.stats.length) {
        el.appendChild(this.buildKpiPerfArea(n, accentForDataCard, viewport));
      }

      // Hover detail panel (KPI/performance card) is a licensed feature —
      // locked out entirely once the trial/license is no longer valid.
      if (features.hoverDetailPanel) {
        const detailPanel = this.buildDetailPanel(n, barStyle, kids.length);
        // The panel normally opens to the right of the card (left: 100% + 10px in CSS).
        // For a node near the right edge of the stage, opening rightward pushes it past
        // the visible/scrollable area and gets clipped — this is what cut off the
        // Overall Performance % in the reported screenshot. Flip it to open to the
        // LEFT instead whenever there isn't ~260px of room to the right.
        const PANEL_WIDTH_WITH_GAP = 260;
        if (pos.x + cardW + PANEL_WIDTH_WITH_GAP > width) {
          detailPanel.classList.add("sop-panel-flip-x");
        }
        // Same idea vertically: a node near the stage's bottom edge would have its panel
        // (anchored at top:0 of the card, growing downward) clipped by the viewport.
        if (pos.y + 260 > height) {
          detailPanel.classList.add("sop-panel-flip-y");
        }
        el.appendChild(detailPanel);
      }

      if (kids.length) {
        const toggle = mkText("div", "sop-toggle", isCollapsed ? "+" : "\u2212");
        el.appendChild(toggle);
        toggle.addEventListener("click", (e: Event) => {
          e.stopPropagation();
          if (this.collapsedIds.has(n.id)) this.collapsedIds.delete(n.id); else this.collapsedIds.add(n.id);
          this.render(viewport);
        });
      }

      const clickTarget = el.querySelector(cardSelector[cardStyle] || ".sop-card");
      if (clickTarget) {
        clickTarget.addEventListener("click", (e: Event) => {
          e.stopPropagation();
          const me = e as MouseEvent;
          this.selectNode(n.id, !!(me.ctrlKey || me.metaKey));
          if (!focusMode) return;
          this.focusedId = this.focusedId === n.id ? null : n.id;
          this.applyFocus(focusMode);
        });
      }
    });

    this.applyFocus(focusMode);
    this.applySelection();
  }

  // ---- Cross-filtering of the other visuals --------------------------------------------------
  // Clicking a person (or a department in the legend) applies a basic filter on that column
  // (the same mechanism a slicer uses). Verified to filter other visuals in Power BI Desktop,
  // where row-identity selections from this table-style data view did not.
  private colSel = new Set<string>();

  private columnTarget(role: string): { table: string; column: string; index: number } | null {
    const dv = this.lastDataView as any;
    const table = dv && dv.table;
    if (!table) return null;
    const index = table.columns.findIndex((c: any) => c.roles && c.roles[role]);
    if (index < 0) return null;
    const qn: string = table.columns[index].queryName || "";
    const dot = qn.indexOf(".");
    return dot > 0
      ? { table: qn.slice(0, dot), column: qn.slice(dot + 1), index }
      : { table: table.columns[index].displayName || "Table", column: table.columns[index].displayName || role, index };
  }

  private sendFilter(target: { table: string; column: string }, values: any[], remove: boolean): void {
    const filter: any = {
      $schema: "https://powerbi.com/product/schema#basic",
      filterType: 1,
      target: { table: target.table, column: target.column },
      operator: "In",
      values
    };
    this.host.applyJsonFilter(filter, "general", "filter", remove ? powerbi.FilterAction.remove : powerbi.FilterAction.merge);
  }

  /** Removes the person filter and/or the department filter, whichever is active. */
  private clearCrossFilters(): void {
    const emp = this.columnTarget("employeeId");
    const dep = this.columnTarget("department");
    if (this.colSel.size && emp) { this.sendFilter(emp, [], true); }
    if (this.currentDeptFilter && dep) { this.sendFilter(dep, [], true); }
    this.colSel.clear();
    this.currentDeptFilter = null;
  }

  private applyPersonFilter(): void {
    const emp = this.columnTarget("employeeId");
    const table = (this.lastDataView as any)?.table;
    if (!emp || !table) return;
    if (this.currentDeptFilter) {
      const dep = this.columnTarget("department");
      if (dep) this.sendFilter(dep, [], true);
      this.currentDeptFilter = null;
    }
    const values: any[] = [];
    this.colSel.forEach(id => {
      const n = this.nodesById[id];
      if (n) values.push(table.rows[n.rowIndex][emp.index]);
    });
    this.sendFilter(emp, values, values.length === 0);
    this.applySelection();
  }

  /** Re-reads the active filter from the host (report reopened, or filter cleared elsewhere). */
  private restoreFilterState(options: VisualUpdateOptions, dataView: DataView): void {
    const jf: any[] = ((options as any).jsonFilters as any[]) || [];
    const table: any = dataView && dataView.table;
    if (!jf.length || !table) {
      if (this.colSel.size || this.currentDeptFilter) { this.colSel.clear(); this.currentDeptFilter = null; }
      return;
    }
    const f = jf[0];
    const col = f && f.target && f.target.column;
    const vals: any[] = (f && f.values) || [];
    const find = (role: string) => table.columns.findIndex((c: any) => c.roles && c.roles[role]);
    const ei = find("employeeId"), di = find("department");
    const nameOf = (i: number) => {
      const qn: string = i >= 0 ? (table.columns[i].queryName || "") : "";
      return qn.indexOf(".") > 0 ? qn.slice(qn.indexOf(".") + 1) : (i >= 0 ? table.columns[i].displayName : "");
    };
    if (ei >= 0 && col === nameOf(ei)) {
      const want = new Set(vals.map(v => String(v)));
      this.colSel.clear();
      this.nodes.forEach(n => { if (want.has(String(table.rows[n.rowIndex][ei]))) this.colSel.add(n.id); });
      this.currentDeptFilter = null;
    } else if (di >= 0 && col === nameOf(di)) {
      this.currentDeptFilter = vals.length ? String(vals[0]) : null;
      this.colSel.clear();
    }
  }

  /** Selects a person: this is what filters/highlights the OTHER visuals on the page. */
  private selectNode(id: string, multi: boolean): void {
    // Hosts that embed the visual non-interactively (e.g. a dashboard tile) set this to false.
    if (this.host.hostCapabilities && this.host.hostCapabilities.allowInteractions === false) return;
    if (multi) {
      if (this.colSel.has(id)) this.colSel.delete(id); else this.colSel.add(id);
    } else if (this.colSel.size === 1 && this.colSel.has(id)) {
      this.colSel.clear();
    } else {
      this.colSel.clear();
      this.colSel.add(id);
    }
    this.applyPersonFilter();
  }

  private onNodeContextMenu(e: MouseEvent, id: string): void {
    e.preventDefault();
    e.stopPropagation();
    const sid = this.nodeSelectionIds[id];
    this.selectionManager.showContextMenu(sid || ({} as ISelectionId), { x: e.clientX, y: e.clientY });
  }

  /** Marks selected cards and softly dims the rest while a selection exists. */
  private applySelection(): void {
    if (!this.nodesEl) return;
    const selected = this.selectionManager.getSelectionIds() as ISelectionId[];
    const keys = new Set<string>();
    this.colSel.forEach(i => keys.add(i));
    if (this.currentDeptFilter) {
      this.nodes.forEach(n => { if (n.department === this.currentDeptFilter) keys.add(n.id); });
    }
    selected.forEach(sel => {
      Object.keys(this.nodeSelectionIds).forEach(id => {
        if (this.nodeSelectionIds[id] && this.nodeSelectionIds[id].equals(sel)) keys.add(id);
      });
    });
    const any = keys.size > 0;
    this.nodesEl.querySelectorAll<HTMLElement>(".sop-node").forEach(el => {
      const on = keys.has(el.dataset.id!);
      el.classList.toggle("selected", on);
      el.classList.toggle("sel-dimmed", any && !on);
    });
  }

  private applyFocus(focusMode: boolean): void {
    const related = focusMode ? this.relatedIds(this.focusedId) : null;
    this.nodesEl.querySelectorAll<HTMLElement>(".sop-node").forEach(el => {
      const id = el.dataset.id!;
      el.classList.toggle("dimmed", !!related && !related.has(id));
    });
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    try {
      return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    } catch (err) {
      console.error("Smart Org Pro: getFormattingModel() failed, Format pane will be empty instead of the whole visual breaking.", err);
      return { cards: [] };
    }
  }
}
