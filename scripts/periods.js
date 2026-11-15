/*!
 * ⏳ Timeline Builder
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - Periods
 *
 * A period is a named span of entries, anchored to two entry ids. This module is pure: it imports
 * only config.js and touches no Foundry global, so every surface (viewer, manager, PDF) resolves
 * periods the same way and a client can test it through a dynamic import().
 *
 * Why periods are stored this way (alternatives that were weighed and lost):
 * - An "ends at" field on every entry: feature UI on every row for people who never use it, no way to
 *   express overlap or a named era, and delete/reorder would have to keep per-entry fields consistent.
 * - A "period" kind of entry (a wide card) in the same list: the viewer's zig-zag is a flat nth-child
 *   pattern of fixed-width slots; a wide card breaks it and still cannot overlap another.
 * - Anchoring to real dates: entries are evenly spaced and `period` is free text in most timelines,
 *   so a date scale would be a different product. Anchoring to entry ids makes a period follow
 *   drag-reorder, "Sort" and autoSort for free.
 * - Deleting a period when an anchor entry is deleted: silent data loss. The anchor is cleared and
 *   the Periods window flags the period instead.
 * - The display mode as a per-player preference: the GM picks the look per timeline.
 * - A "Bands" display (tinted backgrounds behind the covered entries) was built and dropped after
 *   a visual review; only Off and Lane remain, and a stored "band" falls back to the default.
 * - Lanes assigned separately by each surface (viewer, manager, PDF): the copies would drift, so
 *   resolvePeriods below is the only place lanes are assigned.
 * - Rendering the period DOM always and hiding it with CSS: it would cost layout for timelines that
 *   use no periods, which must render exactly as before.
 */

import { PERIOD_DISPLAY, DEFAULT_PERIOD_DISPLAY, MAX_PERIOD_LANES, MAX_PERIOD_NAME_LENGTH } from "./config.js";

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

/** The display mode a timeline uses; unknown or missing values fall back to the default. */
export function getPeriodDisplay(timeline) {
  return Object.values(PERIOD_DISPLAY).includes(timeline?.periodDisplay)
    ? timeline.periodDisplay
    : DEFAULT_PERIOD_DISPLAY;
}

/** The color a period is drawn in: its own, else the timeline's default, else the theme's. */
export function periodColor(color, timeline) {
  return color || timeline.defaultColor || "var(--tl-primary)";
}

/**
 * "412 → 498" from the two anchor entries' timeframe text. A mystery timeframe reads "???"
 * (as on the card). Empty or identical ends collapse to a single value; both empty gives "".
 */
export function periodLabel(startEntry, endEntry, separator = " → ") {
  const text = (entry) => (entry.mysteryTimeframe ? "???" : entry.period || "");
  return [...new Set([text(startEntry), text(endEntry)].filter(Boolean))].join(separator);
}

/**
 * Resolve a timeline's stored periods against the entries a surface can show.
 * @param {object} timeline
 * @param {Array<{id: string, period?: string, mysteryTimeframe?: boolean}>} entries
 *   In display order, already limited to what this viewer may see (and masked).
 * @param {{separator?: string, ignoreDisplay?: boolean}} [options]
 *   `ignoreDisplay` is for the editor, which resolves even when the mode is "none".
 * @returns {{periods: object[], laneCount: number}} Every stored period, in stored order, each with
 *   `status`; renderers keep `status === "ok"`. `laneCount` counts the lanes the "ok" ones use.
 */
export function resolvePeriods(timeline, entries, { separator = " → ", ignoreDisplay = false } = {}) {
  const stored = Array.isArray(timeline?.periods) ? timeline.periods : [];
  if (!ignoreDisplay && getPeriodDisplay(timeline) === PERIOD_DISPLAY.NONE) return { periods: [], laneCount: 0 };

  const indexById = new Map(entries.map((entry, i) => [entry.id, i]));
  const periods = stored.map((p) => {
    const a = indexById.get(p.startEntryId);
    const b = indexById.get(p.endEntryId);
    // An anchor that is cleared, deleted, or hidden from this viewer: nothing to draw.
    if (a === undefined || b === undefined) return { ...p, status: "incomplete", lane: -1 };
    const start = Math.min(a, b);   // anchors are unordered: reordering entries may swap them
    const end = Math.max(a, b);
    return {
      ...p,
      status: "ok",
      start,
      end,
      lane: -1,
      entryIds: entries.slice(start, end + 1).map((e) => e.id),
      label: periodLabel(entries[start], entries[end], separator),
      color: periodColor(p.color, timeline)
    };
  });

  // Greedy interval colouring: outer (longer) periods first so nesting stays tidy.
  const placed = periods
    .filter((p) => p.status === "ok")
    .sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start));
  const laneEnds = [];   // last entry index occupied in each lane
  for (const p of placed) {
    let lane = laneEnds.findIndex((last) => last < p.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = p.end;
    p.lane = lane;
    if (lane >= MAX_PERIOD_LANES) p.status = "overflow";
  }
  return { periods, laneCount: Math.min(laneEnds.length, MAX_PERIOD_LANES) };
}

/**
 * Clean a timeline's periods at a trust boundary (import). Drops records with no unique string id,
 * clamps names, clears anchors that name no entry of this timeline and non-hex colors.
 * @returns {object[]} The sanitized `periods` array (never mutates `timeline`).
 */
export function sanitizePeriods(timeline) {
  const entryIds = new Set((timeline.entries ?? []).map((e) => e.id));
  const seen = new Set();
  const clean = [];
  for (const raw of Array.isArray(timeline.periods) ? timeline.periods : []) {
    if (!raw || typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) continue;
    seen.add(raw.id);
    clean.push({
      id: raw.id,
      name: String(raw.name ?? "").trim().slice(0, MAX_PERIOD_NAME_LENGTH) || "Period",
      startEntryId: entryIds.has(raw.startEntryId) ? raw.startEntryId : "",
      endEntryId: entryIds.has(raw.endEntryId) ? raw.endEntryId : "",
      color: HEX_COLOR.test(raw.color ?? "") ? raw.color : ""
    });
  }
  return clean;
}

/**
 * For each entry id, the periods that cover it as rail marks.
 * @param {object[]} periods  The `periods` array returned by resolvePeriods (any status).
 * @param {string[]} entryIds Display order.
 * @returns {Map<string, Array<{lane: number, color: string, name: string, role: "only"|"start"|"mid"|"end"}>>}
 *   Only `status === "ok"` periods produce marks. Marks are sorted by lane.
 */
export function periodMarksByEntry(periods, entryIds) {
  const marks = new Map(entryIds.map((id) => [id, []]));
  for (const p of periods) {
    if (p.status !== "ok") continue;
    p.entryIds.forEach((id, i) => {
      const role = p.entryIds.length === 1 ? "only" : i === 0 ? "start" : i === p.entryIds.length - 1 ? "end" : "mid";
      marks.get(id)?.push({ lane: p.lane, color: p.color, name: p.name, role });
    });
  }
  for (const list of marks.values()) list.sort((a, b) => a.lane - b.lane);
  return marks;
}
