/*!
 * ⏳ Timeline Builder
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - Import / Export Application
 * Opened from Foundry's Configure Settings menu (not the Manager window). Lets the
 * GM export a chosen set of timelines to a JSON file, and import timelines from a
 * JSON file with per-timeline conflict resolution against the current world's data.
 */

import { MODULE_ID, TEMPLATES } from "../config.js";
import { BaseHandlebarsForm } from "./BaseHandlebarsForm.js";

export class ImportExportForm extends BaseHandlebarsForm {
  /** Timelines parsed from the last loaded import file, with conflict info per item. */
  #importItems = null;

  static DEFAULT_OPTIONS = {
    id: "timeline-import-export",
    classes: ["timeline-builder", "import-export"],
    window: {
      title: "Import / Export Timelines",
      icon: "fa-solid fa-file-import",
      resizable: true
    },
    position: { width: 480, height: "auto" },
    actions: {
      toggleSelectAllExport: ImportExportForm.#onToggleSelectAllExport,
      exportSelected: ImportExportForm.#onExportSelected,
      importSelected: ImportExportForm.#onImportSelected
    }
  };

  static PARTS = {
    content: { template: TEMPLATES.IMPORT_EXPORT }
  };

  async _prepareContext(options) {
    const timelines = this._getTimelines().map(t => {
      const count = t.entries?.length ?? 0;
      return {
        id: t.id,
        name: t.name,
        entryLabel: `${count} ${count === 1 ? "entry" : "entries"}`
      };
    });

    return {
      ...await super._prepareContext(options),
      timelines
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;

    // Tab switching (same pattern as the timeline settings dialog in manager.js).
    const tabs = html.querySelectorAll(".settings-tab");
    const panes = html.querySelectorAll(".tab-pane");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        panes.forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        html.querySelector(`.tab-pane[data-tab="${tab.dataset.tab}"]`)?.classList.add("active");
      });
    });

    html.querySelector("#importFileInput")?.addEventListener("change", (ev) => this.#onFileSelected(ev));
  }

  // ── Export ─────────────────────────────────────────────────

  static #onToggleSelectAllExport(event, target) {
    const checked = target.checked;
    this.element.querySelectorAll(".export-check").forEach(cb => { cb.checked = checked; });
  }

  static async #onExportSelected(event, target) {
    const ids = Array.from(this.element.querySelectorAll(".export-check:checked")).map(cb => cb.value);
    if (!ids.length) {
      return this._notifyWarning("Select at least one timeline to export.");
    }

    const timelines = this._getTimelines().filter(t => ids.includes(t.id));
    const payload = {
      moduleId: MODULE_ID,
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? "",
      exportedAt: new Date().toISOString(),
      timelines: foundry.utils.deepClone(timelines)
    };

    const filename = timelines.length === 1
      ? `${timelines[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "timeline"}.json`
      : `timeline-builder-export-${Date.now()}.json`;

    foundry.utils.saveDataToFile(JSON.stringify(payload, null, 2), "application/json", filename);
    this._notifyInfo(`Exported ${timelines.length} ${timelines.length === 1 ? "timeline" : "timelines"}.`);
  }

  // ── Import ─────────────────────────────────────────────────

  async #onFileSelected(event) {
    const file = event.target.files?.[0];
    const preview = this.element.querySelector(".ie-import-preview");
    const importBtn = this.element.querySelector('[data-action="importSelected"]');

    this.#importItems = null;
    importBtn.disabled = true;
    preview.innerHTML = "";
    if (!file) return;

    let data;
    try {
      const text = await foundry.utils.readTextFromFile(file);
      data = JSON.parse(text);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to read import file`, err);
      return this._notifyError("That file could not be read as JSON.");
    }

    const valid = Array.isArray(data?.timelines)
      && data.timelines.every(t => t?.id && t?.name && Array.isArray(t.entries));
    if (!valid) {
      return this._notifyError("That file doesn't look like a Timeline Builder export.");
    }

    const existing = this._getTimelines();
    this.#importItems = data.timelines.map(timeline => {
      const conflict = existing.find(t => t.id === timeline.id);
      return {
        timeline,
        conflict: !!conflict,
        conflictName: conflict?.name ?? null,
        resolution: conflict ? "copy" : "new"
      };
    });

    preview.innerHTML = this.#buildImportPreviewHtml();
    preview.querySelectorAll(".import-check").forEach(cb =>
      cb.addEventListener("change", () => this.#updateImportButtonState())
    );
    preview.querySelectorAll(".import-resolution").forEach(select =>
      select.addEventListener("change", (ev) => {
        const index = Number(ev.target.dataset.index);
        this.#importItems[index].resolution = ev.target.value;
      })
    );
    this.#updateImportButtonState();
  }

  #buildImportPreviewHtml() {
    return this.#importItems.map((item, index) => {
      const count = item.timeline.entries?.length ?? 0;
      const entryLabel = `${count} ${count === 1 ? "entry" : "entries"}`;
      const badge = item.conflict
        ? `<span class="ie-badge ie-badge-conflict">Conflict — "${item.conflictName}" already exists</span>`
        : `<span class="ie-badge ie-badge-new">New</span>`;
      const resolution = item.conflict
        ? `<select class="import-resolution tl-combobox" data-index="${index}">
            <option value="copy" selected>Import as copy</option>
            <option value="replace">Replace existing</option>
            <option value="skip">Skip</option>
          </select>`
        : "";

      return `
        <label class="ie-list-item">
          <input type="checkbox" class="import-check" data-index="${index}" checked>
          <span class="ie-item-name">${item.timeline.name}</span>
          <span class="ie-item-meta">${entryLabel}</span>
          ${badge}
          ${resolution}
        </label>`;
    }).join("");
  }

  #updateImportButtonState() {
    const importBtn = this.element.querySelector('[data-action="importSelected"]');
    const anyChecked = this.element.querySelectorAll(".import-check:checked").length > 0;
    importBtn.disabled = !anyChecked;
  }

  static async #onImportSelected(event, target) {
    if (!this.#importItems) return;

    const checkedIndexes = Array.from(this.element.querySelectorAll(".import-check:checked"))
      .map(cb => Number(cb.dataset.index));

    const selections = checkedIndexes
      .map(index => this.#importItems[index])
      .filter(item => item.resolution !== "skip")
      .map(item => ({ timeline: item.timeline, resolution: item.resolution }));

    if (!selections.length) {
      return this._notifyWarning("Select at least one timeline to import.");
    }

    const imported = await this._store.importTimelines(selections);
    this._notifyInfo(`Imported ${imported.length} ${imported.length === 1 ? "timeline" : "timelines"}.`);
    this.render();
  }
}
