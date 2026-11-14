/*!
 * ⏳ Timeline Builder
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - Configuration Constants
 */

export const MODULE_ID = "timeline-builder";
export const MODULE_NAME = "Timeline Builder";

export const SETTINGS = {
  DATA: "data",
  TAGS: "tags",
  COLORS: "colors",
  BROADCAST: "broadcast"
};

export const TEMPLATES = {
  MANAGER: `modules/${MODULE_ID}/templates/manager.hbs`,
  EDITOR: `modules/${MODULE_ID}/templates/editor.hbs`,
  VIEWER: `modules/${MODULE_ID}/templates/viewer.hbs`,
  ENTRY: `modules/${MODULE_ID}/templates/timeline-entry.hbs`,
  WELCOME: `modules/${MODULE_ID}/templates/welcome.hbs`,
  IMPORT_EXPORT: `modules/${MODULE_ID}/templates/import-export.hbs`
};

export const DEFAULT_COLORS = [
  { id: "red", label: "Red", value: "#FF0000" },
  { id: "orange", label: "Orange", value: "#FF8000" },
  { id: "yellow", label: "Yellow", value: "#FFFF00" },
  { id: "chartreuse", label: "Chartreuse", value: "#80FF00" },
  { id: "green", label: "Green", value: "#00FF00" },
  { id: "cyan", label: "Cyan", value: "#00FFFF" },
  { id: "azure", label: "Azure", value: "#0080FF" },
  { id: "blue", label: "Blue", value: "#0000FF" },
  { id: "violet", label: "Violet", value: "#8000FF" },
  { id: "magenta", label: "Magenta", value: "#FF00FF" }
];

/** How a timeline draws its periods. */
export const PERIOD_DISPLAY = Object.freeze({ NONE: "none", LANE: "lane", BAND: "band" });
/** Used when a timeline has no `periodDisplay` stored. */
export const DEFAULT_PERIOD_DISPLAY = PERIOD_DISPLAY.LANE;
/** Periods that may overlap on one entry. Bounds the vertical space the viewer reserves. */
export const MAX_PERIOD_LANES = 4;
export const MAX_PERIOD_NAME_LENGTH = 40;
