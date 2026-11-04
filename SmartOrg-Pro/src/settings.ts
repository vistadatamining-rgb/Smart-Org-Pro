"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { APP_INFO } from "./Core/appInfo";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class CardStyleCardSettings extends FormattingSettingsCard {
  style = new formattingSettings.ItemDropdown({
    name: "style",
    displayName: "Card style",
    items: [
      { value: "glass",    displayName: "Glass Card (Hover KPI panel)" },
      { value: "pill",     displayName: "Pill Card (Photo ribbon)" },
      { value: "minimal",  displayName: "Minimal Flat" },
      { value: "ribbon",   displayName: "Ribbon Badge" },
      { value: "outline",  displayName: "Outline" },
      { value: "photoBg",  displayName: "Photo Background" },
      { value: "neumorph", displayName: "Neumorphic" }
    ],
    value: { value: "glass", displayName: "Glass Card (Hover KPI panel)" }
  });

  pillPalette = new formattingSettings.ItemDropdown({
    name: "pillPalette",
    displayName: "Pill Card palette",
    items: [
      { value: "vibrant",     displayName: "Vibrant" },
      { value: "sunset",      displayName: "Sunset" },
      { value: "ocean",       displayName: "Ocean" },
      { value: "emerald",     displayName: "Emerald Corporate" },
      { value: "monochrome",  displayName: "Monochrome Executive" }
    ],
    value: { value: "vibrant", displayName: "Vibrant" }
  });

  name: string = "cardStyleSettings";
  displayName: string = "Card Style";
  slices: FormattingSettingsSlice[] = [this.style, this.pillPalette];
}

export class LayoutCardSettings extends FormattingSettingsCard {
  layout = new formattingSettings.ItemDropdown({
    name: "layout",
    displayName: "Layout",
    items: [
      { value: "vertical",   displayName: "Vertical Tree" },
      { value: "horizontal", displayName: "Horizontal Tree" },
      { value: "radial",     displayName: "Radial" },
      { value: "compact",    displayName: "Compact" }
    ],
    value: { value: "vertical", displayName: "Vertical Tree" }
  });

  cardWidth = new formattingSettings.NumUpDown({
    name: "cardWidth",
    displayName: "Card width (px)",
    value: 150
  });

  levelGap = new formattingSettings.NumUpDown({
    name: "levelGap",
    displayName: "Level spacing (px)",
    value: 130
  });

  name: string = "layoutSettings";
  displayName: string = "Layout Engine";
  slices: FormattingSettingsSlice[] = [this.layout, this.cardWidth, this.levelGap];
}

export class ThemeCardSettings extends FormattingSettingsCard {
  theme = new formattingSettings.ItemDropdown({
    name: "theme",
    displayName: "Theme",
    items: [
      { value: "darkNeon",   displayName: "Dark Neon" },
      { value: "corporate",  displayName: "Corporate" },
      { value: "finance",    displayName: "Finance" },
      { value: "hr",         displayName: "HR" },
      { value: "healthcare", displayName: "Healthcare" },
      { value: "appleGlass", displayName: "Apple Glass" }
    ],
    value: { value: "darkNeon", displayName: "Dark Neon" }
  });

  name: string = "themeSettings";
  displayName: string = "Theme Engine";
  slices: FormattingSettingsSlice[] = [this.theme];
}

export class ConnectorCardSettings extends FormattingSettingsCard {
  style = new formattingSettings.ItemDropdown({
    name: "style",
    displayName: "Connector style",
    items: [
      { value: "elbowDashed",  displayName: "Dashed" },
      { value: "straight",     displayName: "Straight" },
      { value: "curved",       displayName: "Curved" },
      { value: "animatedFlow", displayName: "Animated Flow" },
      { value: "neonGlow",     displayName: "Neon Glow" }
    ],
    value: { value: "elbowDashed", displayName: "Dashed" }
  });

  color = new formattingSettings.ColorPicker({
    name: "color",
    displayName: "Line color",
    value: { value: "#3ba7ff" }
  });

  thickness = new formattingSettings.NumUpDown({
    name: "thickness",
    displayName: "Line thickness (px)",
    value: 1.5
  });

  name: string = "connectorSettings";
  displayName: string = "Connector Lines";
  slices: FormattingSettingsSlice[] = [this.style, this.color, this.thickness];
}

export class ConditionalFormatCardSettings extends FormattingSettingsCard {
  mode = new formattingSettings.ItemDropdown({
    name: "mode",
    displayName: "Color mode",
    items: [
      { value: "single",     displayName: "Single color" },
      { value: "twoColor",   displayName: "Two color" },
      { value: "threeColor", displayName: "Three color" }
    ],
    value: { value: "threeColor", displayName: "Three color" }
  });

  colorMin = new formattingSettings.ColorPicker({
    name: "colorMin",
    displayName: "Low color",
    value: { value: "#ff5c5c" }
  });

  colorMid = new formattingSettings.ColorPicker({
    name: "colorMid",
    displayName: "Mid color",
    value: { value: "#ffb238" }
  });

  colorMax = new formattingSettings.ColorPicker({
    name: "colorMax",
    displayName: "High color",
    value: { value: "#33d17a" }
  });

  name: string = "conditionalFormatSettings";
  displayName: string = "Conditional Formatting (Performance)";
  slices: FormattingSettingsSlice[] = [this.mode, this.colorMin, this.colorMid, this.colorMax];
}

export class ProgressBarCardSettings extends FormattingSettingsCard {
  style = new formattingSettings.ItemDropdown({
    name: "style",
    displayName: "Progress bar style",
    items: [
      { value: "linear",    displayName: "Linear Gradient" },
      { value: "neon",      displayName: "Neon Progress" },
      { value: "liquid",    displayName: "Liquid Fill" },
      { value: "segmented", displayName: "Segmented" },
      { value: "ring",      displayName: "Circular Ring" }
    ],
    value: { value: "linear", displayName: "Linear Gradient" }
  });

  name: string = "progressBarSettings";
  displayName: string = "Performance Bar";
  slices: FormattingSettingsSlice[] = [this.style];
}

export class InteractionCardSettings extends FormattingSettingsCard {
  focusModeEnabled = new formattingSettings.ToggleSwitch({
    name: "focusModeEnabled",
    displayName: "Enable Focus Mode",
    value: false
  });

  startCollapsedBelowLevel = new formattingSettings.NumUpDown({
    name: "startCollapsedBelowLevel",
    displayName: "Auto-collapse below level (0 = none)",
    value: 0
  });

  name: string = "interactionSettings";
  displayName: string = "Interaction";
  slices: FormattingSettingsSlice[] = [this.focusModeEnabled, this.startCollapsedBelowLevel];
}

export class LicenseCardSettings extends FormattingSettingsCard {
  customerEmail = new formattingSettings.TextInput({
    name: "customerEmail",
    displayName: "Customer email",
    placeholder: "you@company.com",
    value: ""
  });

  activationKey = new formattingSettings.TextInput({
    name: "activationKey",
    displayName: "Activation key",
    placeholder: "paste the license key you were sent",
    value: ""
  });

  deviceCode = new formattingSettings.TextInput({
    name: "deviceCode",
    displayName: "This device's code",
    placeholder: "",
    value: ""
  });

  status = new formattingSettings.TextInput({
    name: "status",
    displayName: "Status",
    placeholder: "",
    value: ""
  });

  name: string = "licenseSettings";
  displayName: string = "License";
  slices: FormattingSettingsSlice[] = [this.customerEmail, this.activationKey, this.deviceCode, this.status];
}

export class DepartmentColorCardSettings extends FormattingSettingsCard {
  slot1 = new formattingSettings.ColorPicker({ name: "slot1", displayName: "Color 1", value: { value: "#6d5bf5" } });
  slot2 = new formattingSettings.ColorPicker({ name: "slot2", displayName: "Color 2", value: { value: "#3ba7ff" } });
  slot3 = new formattingSettings.ColorPicker({ name: "slot3", displayName: "Color 3", value: { value: "#ff4d8d" } });
  slot4 = new formattingSettings.ColorPicker({ name: "slot4", displayName: "Color 4", value: { value: "#33d17a" } });
  slot5 = new formattingSettings.ColorPicker({ name: "slot5", displayName: "Color 5", value: { value: "#ffb238" } });
  slot6 = new formattingSettings.ColorPicker({ name: "slot6", displayName: "Color 6", value: { value: "#14b8a6" } });
  slot7 = new formattingSettings.ColorPicker({ name: "slot7", displayName: "Color 7", value: { value: "#d4af37" } });
  slot8 = new formattingSettings.ColorPicker({ name: "slot8", displayName: "Color 8", value: { value: "#e6007a" } });

  name: string = "dataPointSettings";
  displayName: string = "Department Colors";
  slices: FormattingSettingsSlice[] = [this.slot1, this.slot2, this.slot3, this.slot4, this.slot5, this.slot6, this.slot7, this.slot8];
}

export class ZoomCardSettings extends FormattingSettingsCard {
  enabled = new formattingSettings.ToggleSwitch({
    name: "enabled",
    displayName: "Enable Ctrl + wheel zoom",
    value: true
  });

  showControls = new formattingSettings.ToggleSwitch({
    name: "showControls",
    displayName: "Show zoom buttons",
    value: true
  });

  defaultZoom = new formattingSettings.NumUpDown({
    name: "defaultZoom",
    displayName: "Default zoom (%)",
    value: 100
  });

  minZoom = new formattingSettings.NumUpDown({
    name: "minZoom",
    displayName: "Min zoom (%)",
    value: 30
  });

  maxZoom = new formattingSettings.NumUpDown({
    name: "maxZoom",
    displayName: "Max zoom (%)",
    value: 300
  });

  name: string = "zoomSettings";
  displayName: string = "Zoom & Pan";
  slices: FormattingSettingsSlice[] = [this.enabled, this.showControls, this.defaultZoom, this.minZoom, this.maxZoom];
}

export class LegendCardSettings extends FormattingSettingsCard {
  show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Show department legend",
    value: true
  });

  position = new formattingSettings.ItemDropdown({
    name: "position",
    displayName: "Position",
    items: [
      { value: "right",  displayName: "Right" },
      { value: "left",   displayName: "Left" },
      { value: "top",    displayName: "Top" },
      { value: "bottom", displayName: "Bottom" },
      { value: "hidden", displayName: "Hidden (don't show)" }
    ],
    value: { value: "right", displayName: "Right" }
  });

  title = new formattingSettings.TextInput({
    name: "title",
    displayName: "Legend title",
    placeholder: "Departments",
    value: "Departments"
  });

  fontSize = new formattingSettings.NumUpDown({
    name: "fontSize",
    displayName: "Font size (px)",
    value: 11
  });

  panelWidth = new formattingSettings.NumUpDown({
    name: "panelWidth",
    displayName: "Panel width (px)",
    value: 150
  });

  textColor = new formattingSettings.ColorPicker({
    name: "textColor",
    displayName: "Text color",
    value: { value: "#8b93a7" }
  });

  name: string = "legendSettings";
  displayName: string = "Department Legend";
  slices: FormattingSettingsSlice[] = [this.show, this.position, this.title, this.fontSize, this.panelWidth, this.textColor];
}

export class KpiPerfCardSettings extends FormattingSettingsCard {
  // On/off switches use ToggleSwitch and style pickers use ItemDropdown here — unlike
  // some other cards in this project, this project's theme/language ItemDropdown
  // controls have been confirmed to persist correctly for this user, so real toggles
  // and dropdowns are used for a much clearer Format pane. If any control on this card
  // is ever reported as "not sticking" again, the proven fallback (NumUpDown with the
  // meaning spelled out in the field name) is documented in this project's notes and
  // can be re-applied to just that field.

  enabled = new formattingSettings.ToggleSwitch({
    name: "enabled",
    displayName: "Enable KPI Performance",
    value: true
  });

  containerStyle = new formattingSettings.ItemDropdown({
    name: "containerStyle",
    displayName: "Container style",
    items: [
      { value: "glass",    displayName: "Glass" },
      { value: "neon",     displayName: "Neon" },
      { value: "gradient", displayName: "Gradient" },
      { value: "sidebar",  displayName: "Sidebar" },
      { value: "elevated", displayName: "Elevated" },
      { value: "outline",  displayName: "Outline" },
      { value: "solid",    displayName: "Solid" },
      { value: "frost",    displayName: "Frost" }
    ],
    value: { value: "glass", displayName: "Glass" }
  });

  // --- progress (expanded state) ------------------------------------------
  progressStyle = new formattingSettings.ItemDropdown({
    name: "progressStyle",
    displayName: "Progress bar style",
    items: [
      { value: "classic",   displayName: "Classic" },
      { value: "segmented", displayName: "Segmented" },
      { value: "marker",    displayName: "Target Marker" },
      { value: "gradient",  displayName: "Gradient" }
    ],
    value: { value: "marker", displayName: "Target Marker" }
  });

  progressHeight = new formattingSettings.NumUpDown({
    name: "progressHeight",
    displayName: "Progress bar height (px)",
    value: 8
  });

  // --- tooltip (hover on an expanded KPI row) ------------------------------
  tooltipEnabled = new formattingSettings.ToggleSwitch({
    name: "tooltipEnabled",
    displayName: "Enable KPI hover tooltip",
    value: true
  });

  tooltipStyle = new formattingSettings.ItemDropdown({
    name: "tooltipStyle",
    displayName: "Tooltip style",
    items: [
      { value: "minimal",    displayName: "Minimal" },
      { value: "executive",  displayName: "Executive Card" },
      { value: "modernDark", displayName: "Modern Dark" },
      { value: "glass",      displayName: "Glass / Premium" },
      { value: "detailed",   displayName: "Detailed Analytics" }
    ],
    value: { value: "glass", displayName: "Glass / Premium" }
  });

  tooltipBackground = new formattingSettings.ColorPicker({
    name: "tooltipBackground",
    displayName: "Tooltip background (overrides the style's own)",
    value: { value: "#12151d" }
  });

  tooltipTextColor = new formattingSettings.ColorPicker({
    name: "tooltipTextColor",
    displayName: "Tooltip text color",
    value: { value: "#eef1f7" }
  });

  tooltipFontSize = new formattingSettings.NumUpDown({
    name: "tooltipFontSize",
    displayName: "Tooltip font size (px)",
    value: 11
  });

  // --- typography / shape ---------------------------------------------------
  fontSize = new formattingSettings.NumUpDown({
    name: "fontSize",
    displayName: "Font size (px)",
    value: 10
  });

  decimals = new formattingSettings.NumUpDown({
    name: "decimals",
    displayName: "Decimal places",
    value: 0
  });

  compact = new formattingSettings.ToggleSwitch({
    name: "compact",
    displayName: "Short numbers like 1.2K/3.4M",
    value: true
  });

  cornerRadius = new formattingSettings.NumUpDown({
    name: "cornerRadius",
    displayName: "Corner radius (px)",
    value: 12
  });

  opacity = new formattingSettings.NumUpDown({
    name: "opacity",
    displayName: "Opacity (%)",
    value: 100
  });

  // Background/label/value color defaults match the darkNeon theme's own --card/
  // --text-1/--text-0 exactly. At render time, a field left at this exact default is
  // resolved to the LIVE theme variable instead of the hardcoded hex, so the KPI area
  // follows the theme picker automatically — pick a different color here and that
  // override always wins over the theme.
  background = new formattingSettings.ColorPicker({
    name: "background",
    displayName: "Background (default = follows the visual's theme)",
    value: { value: "#161b26" }
  });

  labelColor = new formattingSettings.ColorPicker({
    name: "labelColor",
    displayName: "Label color (default = follows the visual's theme)",
    value: { value: "#8b93a7" }
  });

  valueColor = new formattingSettings.ColorPicker({
    name: "valueColor",
    displayName: "Value color, no target (default = follows the visual's theme)",
    value: { value: "#eef1f7" }
  });

  // --- conditional formatting (threshold-based, not a gradient) ------------
  greenThreshold = new formattingSettings.NumUpDown({
    name: "greenThreshold",
    displayName: "Green threshold (achievement % ≥)",
    value: 100
  });

  yellowThreshold = new formattingSettings.NumUpDown({
    name: "yellowThreshold",
    displayName: "Yellow threshold (achievement % ≥, below green)",
    value: 80
  });

  colorGreen = new formattingSettings.ColorPicker({
    name: "colorGreen",
    displayName: "Green (on/above target)",
    value: { value: "#33d17a" }
  });

  colorYellow = new formattingSettings.ColorPicker({
    name: "colorYellow",
    displayName: "Yellow (near target)",
    value: { value: "#ffb238" }
  });

  colorRed = new formattingSettings.ColorPicker({
    name: "colorRed",
    displayName: "Red (below target)",
    value: { value: "#ff5c5c" }
  });

  // --- per-KPI visibility, 8 slots, renamed at runtime to the actual bound
  //     measure names (same pattern as this project's 8 department-color slots) --
  kpiVis1 = new formattingSettings.ToggleSwitch({ name: "kpiVis1", displayName: "KPI slot 1 (not used by your data)", value: true });
  kpiVis2 = new formattingSettings.ToggleSwitch({ name: "kpiVis2", displayName: "KPI slot 2 (not used by your data)", value: true });
  kpiVis3 = new formattingSettings.ToggleSwitch({ name: "kpiVis3", displayName: "KPI slot 3 (not used by your data)", value: true });
  kpiVis4 = new formattingSettings.ToggleSwitch({ name: "kpiVis4", displayName: "KPI slot 4 (not used by your data)", value: true });
  kpiVis5 = new formattingSettings.ToggleSwitch({ name: "kpiVis5", displayName: "KPI slot 5 (not used by your data)", value: true });
  kpiVis6 = new formattingSettings.ToggleSwitch({ name: "kpiVis6", displayName: "KPI slot 6 (not used by your data)", value: true });
  kpiVis7 = new formattingSettings.ToggleSwitch({ name: "kpiVis7", displayName: "KPI slot 7 (not used by your data)", value: true });
  kpiVis8 = new formattingSettings.ToggleSwitch({ name: "kpiVis8", displayName: "KPI slot 8 (not used by your data)", value: true });

  // --- per-KPI direction: on = Lower is better -----------------------------
  kpiDir1 = new formattingSettings.ToggleSwitch({ name: "kpiDir1", displayName: "KPI slot 1 direction (not used)", value: false });
  kpiDir2 = new formattingSettings.ToggleSwitch({ name: "kpiDir2", displayName: "KPI slot 2 direction (not used)", value: false });
  kpiDir3 = new formattingSettings.ToggleSwitch({ name: "kpiDir3", displayName: "KPI slot 3 direction (not used)", value: false });
  kpiDir4 = new formattingSettings.ToggleSwitch({ name: "kpiDir4", displayName: "KPI slot 4 direction (not used)", value: false });
  kpiDir5 = new formattingSettings.ToggleSwitch({ name: "kpiDir5", displayName: "KPI slot 5 direction (not used)", value: false });
  kpiDir6 = new formattingSettings.ToggleSwitch({ name: "kpiDir6", displayName: "KPI slot 6 direction (not used)", value: false });
  kpiDir7 = new formattingSettings.ToggleSwitch({ name: "kpiDir7", displayName: "KPI slot 7 direction (not used)", value: false });
  kpiDir8 = new formattingSettings.ToggleSwitch({ name: "kpiDir8", displayName: "KPI slot 8 direction (not used)", value: false });

  // --- manual target override, kept from the previous data-card feature ----
  // (a number to type in, not a switch — stays NumUpDown either way)
  target1 = new formattingSettings.NumUpDown({
    name: "target1",
    displayName: "KPI slot 1 manual target (not used)",
    value: 0
  });
  target2 = new formattingSettings.NumUpDown({
    name: "target2",
    displayName: "KPI slot 2 manual target (not used)",
    value: 0
  });
  target3 = new formattingSettings.NumUpDown({
    name: "target3",
    displayName: "KPI slot 3 manual target (not used)",
    value: 0
  });
  target4 = new formattingSettings.NumUpDown({
    name: "target4",
    displayName: "KPI slot 4 manual target (not used)",
    value: 0
  });

  name: string = "kpiPerfSettings";
  displayName: string = "KPI Performance (under each person)";
  slices: FormattingSettingsSlice[] = [
    this.enabled, this.containerStyle,
    this.progressStyle, this.progressHeight,
    this.tooltipEnabled, this.tooltipStyle, this.tooltipBackground, this.tooltipTextColor, this.tooltipFontSize,
    this.fontSize, this.decimals, this.compact, this.cornerRadius, this.opacity,
    this.background, this.labelColor, this.valueColor,
    this.greenThreshold, this.yellowThreshold, this.colorGreen, this.colorYellow, this.colorRed,
    this.kpiVis1, this.kpiVis2, this.kpiVis3, this.kpiVis4, this.kpiVis5, this.kpiVis6, this.kpiVis7, this.kpiVis8,
    this.kpiDir1, this.kpiDir2, this.kpiDir3, this.kpiDir4, this.kpiDir5, this.kpiDir6, this.kpiDir7, this.kpiDir8,
    this.target1, this.target2, this.target3, this.target4
  ];
}


export class AboutCardSettings extends FormattingSettingsCard {
  // Informational fields — technically editable text inputs (the formattingSettings API has
  // no read-only label control), but nobody's expected to type into these. Values come from
  // Core/appInfo.ts — the ONE file to edit per build, instead of hardcoding here.
  version = new formattingSettings.TextInput({
    name: "version",
    displayName: "Version",
    value: APP_INFO.version,
    placeholder: ""
  });
  productName = new formattingSettings.TextInput({
    name: "name",
    displayName: "Name",
    value: APP_INFO.productName,
    placeholder: ""
  });
  visit = new formattingSettings.TextInput({
    name: "visit",
    displayName: "Visit",
    value: APP_INFO.companyWebsite,
    placeholder: ""
  });

  privacy = new formattingSettings.TextInput({
    name: "privacy",
    displayName: "Privacy policy",
    value: APP_INFO.privacyUrl,
    placeholder: ""
  });

  name: string = "about";
  displayName: string = "About";
  slices: FormattingSettingsSlice[] = [this.version, this.productName, this.visit, this.privacy];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
  cardStyleCard = new CardStyleCardSettings();
  layoutCard = new LayoutCardSettings();
  themeCard = new ThemeCardSettings();
  connectorCard = new ConnectorCardSettings();
  progressCard = new ProgressBarCardSettings();
  conditionalFormatCard = new ConditionalFormatCardSettings();
  departmentColorCard = new DepartmentColorCardSettings();
  legendCard = new LegendCardSettings();
  kpiPerfCard = new KpiPerfCardSettings();
  zoomCard = new ZoomCardSettings();
  licenseCard = new LicenseCardSettings();
  interactionCard = new InteractionCardSettings();
  aboutCard = new AboutCardSettings();

  cards = [
    this.cardStyleCard, this.layoutCard, this.themeCard, this.connectorCard, this.progressCard,
    this.conditionalFormatCard, this.departmentColorCard, this.legendCard, this.kpiPerfCard,
    this.zoomCard, this.licenseCard, this.interactionCard, this.aboutCard
  ];
}
