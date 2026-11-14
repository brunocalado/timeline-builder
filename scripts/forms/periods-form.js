/*!
 * ⏳ Timeline Builder
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - Periods Window
 * Opened from the Timeline Manager toolbar. Edits one timeline's periods and how they are
 * displayed. The manager owns this window: every write calls `onChange` (the manager's render),
 * and the manager re-renders this window in turn, so there is exactly one render per change.
 */

import { TEMPLATES, MAX_PERIOD_LANES, MAX_PERIOD_NAME_LENGTH } from "../config.js";
import { TimelineStore } from "../store.js";
import { getPeriodDisplay, resolvePeriods } from "../periods.js";
import { BaseHandlebarsForm } from "./BaseHandlebarsForm.js";

const DISPLAY_OPTIONS = [
  { value: "none", label: "Off", icon: "fa-solid fa-eye-slash", hint: "Periods are hidden everywhere but this window. Nothing is deleted." },
  { value: "lane", label: "Lane", icon: "fa-solid fa-bars-staggered", hint: "Bars in a lane above the timeline. Periods may overlap." },
  { value: "band", label: "Bands", icon: "fa-solid fa-object-group", hint: "Tinted bands behind the events. Overlapping periods nest." }
];

export class PeriodsForm extends BaseHandlebarsForm {
  #timelineId;
  #onChange;

  /**
   * @param {string} timelineId
   * @param {{onChange: Function}} options - onChange: the manager re-renders (and with it, this window).
   */
  constructor(timelineId, { onChange, ...options } = {}) {
    super(options);
    this.#timelineId = timelineId;
    this.#onChange = onChange;
  }

  get timelineId() {
    return this.#timelineId;
  }

  static DEFAULT_OPTIONS = {
    id: "timeline-periods",
    classes: ["timeline-builder", "periods"],
    tag: "div",
    window: { title: "Timeline Periods", icon: "fa-solid fa-arrows-left-right", resizable: true },
    position: { width: 620, height: "auto" },
    actions: {
      addPeriod: PeriodsForm.#onAddPeriod,
      deletePeriod: PeriodsForm.#onDeletePeriod
    }
  };

  static PARTS = {
    form: { template: TEMPLATES.PERIODS }
  };

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const timeline = this._getTimeline(this.#timelineId);
    const entries = timeline?.entries ?? [];
    const display = getPeriodDisplay(timeline);
    const { periods } = resolvePeriods(timeline, entries, { ignoreDisplay: true });

    // getColors() returns the settings-owned array: copy before sorting.
    const globalColors = [...this._getColors()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(c => ({ value: c.value, label: c.label }));

    return {
      ...base,
      timeline,
      displayOptions: DISPLAY_OPTIONS.map(o => ({ ...o, checked: o.value === display })),
      periods: periods.map((p, i) => {
        // resolvePeriods fills in a fallback color for drawable periods; the select edits the stored one.
        const color = timeline.periods[i].color;
        const colorOptions = [{ value: "", label: "Default" }, ...globalColors];
        // A color deleted from the global list stays on the period; keep it selectable.
        if (color && !globalColors.some(c => c.value.toLowerCase() === color.toLowerCase())) {
          colorOptions.push({ value: color, label: color });
        }
        return {
          id: p.id,
          name: p.name,
          startEntryId: p.startEntryId,
          endEntryId: p.endEntryId,
          color,
          swatch: color || timeline.defaultColor || "var(--tl-primary)",
          status: p.status,
          statusText: p.status === "incomplete" ? "Pick a start and an end entry."
            : p.status === "overflow" ? `Not shown: more than ${MAX_PERIOD_LANES} periods overlap here.` : "",
          colorOptions
        };
      }),
      entryOptions: entries.map(e => ({
        value: e.id,
        label: `${e.period || "—"} · ${e.name || "Untitled"}${e.hidden ? " (hidden)" : ""}`
      })),
      maxName: MAX_PERIOD_NAME_LENGTH,
      canAdd: entries.length > 0
    };
  }

  /**
   * Listeners go on elements inside the part, never on `this.element`: the part's markup is
   * replaced on every render, while `this.element` persists and would stack duplicates.
   */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const el of this.element.querySelectorAll("[data-field]")) {
      el.addEventListener("change", (event) => this.#onFieldChange(event));
    }
    for (const el of this.element.querySelectorAll('input[name="periodDisplay"]')) {
      el.addEventListener("change", (event) => this.#onDisplayChange(event));
    }
  }

  async #onFieldChange(event) {
    const target = event.target;
    const periodId = target.closest("[data-period-id]").dataset.periodId;
    let value = target.value;
    if (target.dataset.field === "name") {
      value = value.trim().slice(0, MAX_PERIOD_NAME_LENGTH);
      if (!value) return this.render(); // an empty name is reverted, never stored
    }
    await TimelineStore.updatePeriod(this.#timelineId, periodId, { [target.dataset.field]: value });
    this.#onChange();
  }

  async #onDisplayChange(event) {
    await TimelineStore.updateTimeline(this.#timelineId, { periodDisplay: event.target.value });
    this.#onChange();
  }

  static async #onAddPeriod() {
    const colors = this._getColors();
    const count = this._getTimeline(this.#timelineId)?.periods?.length ?? 0;
    // Cycle through the global colors so consecutive periods are told apart without editing.
    await TimelineStore.createPeriod(this.#timelineId, {
      color: colors.length ? colors[count % colors.length].value : ""
    });
    this.#onChange();
  }

  static async #onDeletePeriod(event, target) {
    await TimelineStore.deletePeriod(this.#timelineId, target.dataset.periodId);
    this.#onChange();
  }
}
