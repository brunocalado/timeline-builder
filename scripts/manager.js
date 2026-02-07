/**
 * Timeline Builder - Manager Application (GM Only)
 */

import { MODULE_ID, SETTINGS, TEMPLATES } from "./config.js";
import { TimelineStore } from "./store.js";
import { getGlassStyle, resolveEntryDisplayProps, resolvePageNames } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * Timeline Manager Application for GMs.
 * Allows creating, editing, and managing timelines.
 */
export class TimelineManager extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Currently selected timeline ID for editing */
  #selectedTimelineId = null;

  static DEFAULT_OPTIONS = {
    id: "timeline-manager",
    classes: ["timeline-builder", "manager"],
    tag: "div",
    window: {
      title: "Timeline Manager",
      icon: "fa-solid fa-clock-rotate-left",
      resizable: true
    },
    position: {
      width: 1000,
      height: 650
    },
    actions: {
      createTimeline: TimelineManager.#onCreateTimeline,
      configureTimeline: TimelineManager.#onConfigureTimeline,
      manageTags: TimelineManager.#onManageTags,
      manageColors: TimelineManager.#onManageColors,
      openViewer: TimelineManager.#onOpenViewer,
      broadcastTimeline: TimelineManager.#onBroadcastTimeline,
      managePermissions: TimelineManager.#onManagePermissions,
      selectTimeline: TimelineManager.#onSelectTimeline,
      deleteTimeline: TimelineManager.#onDeleteTimeline,
      toggleVisibility: TimelineManager.#onToggleVisibility,
      addEntry: TimelineManager.#onAddEntry,
      deleteEntry: TimelineManager.#onDeleteEntry,
      toggleEntryVisibility: TimelineManager.#onToggleEntryVisibility,
      moveEntryUp: TimelineManager.#onMoveEntryUp,
      moveEntryDown: TimelineManager.#onMoveEntryDown,
      saveTimeline: TimelineManager.#onSaveTimeline,
      pickImage: TimelineManager.#onPickImage,
      pickTags: TimelineManager.#onPickTags,
      pickColor: TimelineManager.#onPickColor,
      pickEffect: TimelineManager.#onPickEffect,
      insertEntry: TimelineManager.#onInsertEntry,
      sortTimeline: TimelineManager.#onSortTimeline,
      adjustImageFocus: TimelineManager.#onAdjustImageFocus,
      configureMystery: TimelineManager.#onConfigureMystery,
      openLinkedPage: TimelineManager.#onOpenLinkedPage,
      removeLinkedPage: TimelineManager.#onRemoveLinkedPage
    }
  };

  static PARTS = {
    manager: {
      template: TEMPLATES.MANAGER
    }
  };

  /**
   * Prepare context data for rendering.
   */
  async _prepareContext(options) {
    const timelines = TimelineStore.getTimelines();
    const selectedTimeline = this.#selectedTimelineId
      ? TimelineStore.getTimeline(this.#selectedTimelineId)
      : null;

    if (selectedTimeline?.entries) {
      selectedTimeline.entries = selectedTimeline.entries.map(e => {
        const entry = { ...e };
        resolveEntryDisplayProps(entry, selectedTimeline);
        return entry;
      });

      await resolvePageNames(selectedTimeline.entries);
    }

    return {
      timelines,
      selectedTimeline,
      hasTimelines: timelines.length > 0
    };
  }

  /**
   * Setup event listeners after render.
   */
  _onRender(context, options) {
    // Ensure the class is present to apply CSS variables
    this.element.classList.add("timeline-builder");

    // Inject Scrollbar Minimalista "Ghost" styles
    if (!document.getElementById("timeline-ghost-scroll-styles")) {
      const style = document.createElement("style");
      style.id = "timeline-ghost-scroll-styles";
      style.textContent = `
        .timeline-builder *::-webkit-scrollbar {
            width: 6px !important;
            height: 6px !important;
            background: transparent !important;
        }
        .timeline-builder *::-webkit-scrollbar-track {
            background: transparent !important;
            margin: 0 !important;
        }
        .timeline-builder *::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1) !important;
            border-radius: 10px !important;
            border: none !important;
            transition: background-color 0.3s;
        }
        .timeline-builder *::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 152, 0, 0.6) !important;
        }
        .timeline-builder * {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
      `;
      document.head.appendChild(style);
    }

    // Convert period inputs to textareas for word wrapping
    this.element.querySelectorAll("input.entry-period").forEach(input => {
      const ta = document.createElement("textarea");
      ta.className = input.className;
      ta.value = input.value;
      ta.placeholder = input.placeholder || "";
      ta.spellcheck = false;
      ta.rows = 1;
      ta.maxLength = 30;
      input.replaceWith(ta);
      
      const resize = () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      };
      ta.addEventListener("input", resize);
      requestAnimationFrame(resize);
    });

    // Enforce max length on entry names
    this.element.querySelectorAll(".entry-name").forEach(input => {
      input.setAttribute("maxlength", "25");
    });

    // Setup drag and drop for entries
    this.#setupDragDrop();

    // Setup page drop zones for linking journal pages
    this.#setupPageDropZones();

    // Setup input change listeners for live editing
    this.#setupInputListeners();
  }

  /**
   * Setup drag and drop functionality for timeline entries.
   */
  #setupDragDrop() {
    const entryList = this.element.querySelector(".entry-list");
    if (!entryList) return;

    const entries = entryList.querySelectorAll(".timeline-entry");
    entries.forEach(entry => {
      entry.addEventListener("dragstart", this.#onDragStart.bind(this));
      entry.addEventListener("dragover", this.#onDragOver.bind(this));
      entry.addEventListener("drop", this.#onDrop.bind(this));
      entry.addEventListener("dragend", this.#onDragEnd.bind(this));
    });
  }

  /**
   * Setup drop zones for linking journal pages to entries.
   */
  #setupPageDropZones() {
    const zones = this.element.querySelectorAll(".page-drop-zone");
    zones.forEach(zone => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "link";
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("drag-over");
      });
      zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("drag-over");

        let data;
        try {
          data = JSON.parse(e.dataTransfer.getData("text/plain"));
        } catch { return; }

        if (!["JournalEntry", "JournalEntryPage"].includes(data.type) || !data.uuid) return;

        const entryId = zone.dataset.entryId;
        if (!entryId || !this.#selectedTimelineId) return;

        await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
          pageUuid: data.uuid
        });
        this.render();
      });
    });
  }

  /**
   * Setup input listeners for entry editing.
   */
  #setupInputListeners() {
    const inputs = this.element.querySelectorAll(".entry-name, .entry-description");
    inputs.forEach(input => {
      input.addEventListener("change", this.#onEntryInputChange.bind(this));
    });

    const periodInputs = this.element.querySelectorAll(".entry-period");
    const timeline = this.#selectedTimelineId ? TimelineStore.getTimeline(this.#selectedTimelineId) : null;
    const mode = timeline?.timeframeMode || "free";

    periodInputs.forEach(input => {
      if (mode === "free") {
        input.addEventListener("change", this.#onEntryInputChange.bind(this));
      } else {
        input.readOnly = true;
        input.style.cursor = "pointer";
        input.title = "Click to edit timeframe";
        input.addEventListener("click", (e) => this.#onEditTimeframe(e, mode));
      }
    });

    const timelineNameInput = this.element.querySelector(".timeline-name-input");
    if (timelineNameInput) {
      timelineNameInput.addEventListener("change", this.#onTimelineNameChange.bind(this));
    }
  }

  /**
   * Handle timeline name change.
   */
  async #onTimelineNameChange(event) {
    const value = event.target.value;
    if (this.#selectedTimelineId && value) {
      await TimelineStore.updateTimeline(this.#selectedTimelineId, { name: value });
      this.render();
    }
  }

  /**
   * Handle entry input changes.
   */
  async #onEntryInputChange(event) {
    const input = event.target;
    const entryEl = input.closest(".timeline-entry");
    const entryId = entryEl?.dataset.entryId;

    if (!entryId || !this.#selectedTimelineId) return;

    let field;
    if (input.classList.contains("entry-name")) field = "name";
    else if (input.classList.contains("entry-period")) field = "period";
    else field = "description";

    if (field === "period") {
      const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
      const mode = timeline.timeframeMode || "free";
      const val = input.value.trim();

      if (val) {
        let isValid = true;
        let formatExample = "";

        if (mode === "date") {
          // DD/MM/YYYY (allowing 4+ digits for year)
          if (!/^\d{2}\/\d{2}\/\d{4,}$/.test(val)) {
            isValid = false;
            formatExample = "DD/MM/YYYY (e.g. 04/02/3520)";
          }
        } else if (mode === "hour") {
          // HH:MM:SS
          if (!/^\d{2}:\d{2}:\d{2}$/.test(val)) {
            isValid = false;
            formatExample = "HH:MM:SS (e.g. 22:33:49)";
          }
        } else if (mode === "hour2") {
          // HH:MM
          if (!/^\d{2}:\d{2}$/.test(val)) {
            isValid = false;
            formatExample = "HH:MM (e.g. 12:25)";
          }
        } else if (mode === "date_my") {
          // MM/YYYY
          if (!/^\d{2}\/\d{4,}$/.test(val)) {
            isValid = false;
            formatExample = "MM/YYYY (e.g. 05/1920)";
          }
        } else if (mode === "datetime") {
          // DD/MM/YYYY HH:MM
          if (!/^\d{2}\/\d{2}\/\d{4,} \d{2}:\d{2}$/.test(val)) {
            isValid = false;
            formatExample = "DD/MM/YYYY HH:MM (e.g. 31/12/1999 23:59)";
          }
        }

        if (!isValid) {
          ui.notifications.warn(`Invalid format for '${mode}' mode. Expected: ${formatExample}`);
          const entry = timeline.entries.find(e => e.id === entryId);
          input.value = entry ? entry.period : "";
          return;
        }
      }
    }

    await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
      [field]: input.value
    });

    if (field === "period") {
      const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
      if (timeline?.autoSort) {
        await TimelineManager.#performSort(timeline);
        this.render();
      }
    }
  }

  async #onEditTimeframe(event, mode) {
    const input = event.target;
    const entryEl = input.closest(".timeline-entry");
    const entryId = entryEl?.dataset.entryId;
    if (!entryId || !this.#selectedTimelineId) return;

    const val = input.value || "";
    let content = "";
    let callback;

    if (mode === "date") {
      const parts = val.includes("/") ? val.split("/") : [];
      const d = parts[0] || "";
      const m = parts[1] || "";
      const y = parts[2] || "";

      content = `
        <div style="background: #222; padding: 10px; display: flex; gap: 5px; align-items: center; justify-content: center;">
            <input type="number" name="day" placeholder="DD" value="${d}" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">/</span>
            <input type="number" name="month" placeholder="MM" value="${m}" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">/</span>
            <input type="number" name="year" placeholder="YYYY" value="${y}" oninput="if(this.value.length>6)this.value=this.value.slice(0,6);" style="width: 80px; text-align: center;">
        </div>`;

      callback = (html) => {
        let day = html.querySelector("input[name=day]").value;
        let month = html.querySelector("input[name=month]").value;
        let year = html.querySelector("input[name=year]").value;
        
        if (!day && !month && !year) return "";
        
        day = day.padStart(2, "0") || "00";
        month = month.padStart(2, "0") || "00";
        year = year || "0000";
        
        return `${day}/${month}/${year}`;
      };
    } else if (mode === "hour") {
      const parts = val.includes(":") ? val.split(":") : [];
      const h = parts[0] || "";
      const m = parts[1] || "";
      const s = parts[2] || "";

      content = `
        <div style="background: #222; padding: 10px; display: flex; gap: 5px; align-items: center; justify-content: center;">
            <input type="number" name="hour" placeholder="HH" value="${h}" min="0" max="23" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">:</span>
            <input type="number" name="min" placeholder="MM" value="${m}" min="0" max="59" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">:</span>
            <input type="number" name="sec" placeholder="SS" value="${s}" min="0" max="59" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
        </div>`;

      callback = (html) => {
        let hour = html.querySelector("input[name=hour]").value;
        let min = html.querySelector("input[name=min]").value;
        let sec = html.querySelector("input[name=sec]").value;

        if (!hour && !min && !sec) return "";

        hour = hour.padStart(2, "0") || "00";
        min = min.padStart(2, "0") || "00";
        sec = sec.padStart(2, "0") || "00";

        return `${hour}:${min}:${sec}`;
      };
    } else if (mode === "hour2") {
      const parts = val.includes(":") ? val.split(":") : [];
      const h = parts[0] || "";
      const m = parts[1] || "";

      content = `
        <div style="background: #222; padding: 10px; display: flex; gap: 5px; align-items: center; justify-content: center;">
            <input type="number" name="hour" placeholder="HH" value="${h}" min="0" max="23" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">:</span>
            <input type="number" name="min" placeholder="MM" value="${m}" min="0" max="59" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
        </div>`;

      callback = (html) => {
        let hour = html.querySelector("input[name=hour]").value;
        let min = html.querySelector("input[name=min]").value;

        if (!hour && !min) return "";

        hour = hour.padStart(2, "0") || "00";
        min = min.padStart(2, "0") || "00";

        return `${hour}:${min}`;
      };
    } else if (mode === "date_my") {
      const parts = val.includes("/") ? val.split("/") : [];
      const m = parts[0] || "";
      const y = parts[1] || "";

      content = `
        <div style="background: #222; padding: 10px; display: flex; gap: 5px; align-items: center; justify-content: center;">
            <input type="number" name="month" placeholder="MM" value="${m}" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            <span style="font-weight: bold;">/</span>
            <input type="number" name="year" placeholder="YYYY" value="${y}" oninput="if(this.value.length>6)this.value=this.value.slice(0,6);" style="width: 80px; text-align: center;">
        </div>`;

      callback = (html) => {
        let month = html.querySelector("input[name=month]").value;
        let year = html.querySelector("input[name=year]").value;
        
        if (!month && !year) return "";
        
        month = month.padStart(2, "0") || "00";
        year = year || "0000";
        
        return `${month}/${year}`;
      };
    } else if (mode === "datetime") {
      const parts = val.split(" ");
      const dVal = parts[0] || "";
      const tVal = parts[1] || "";
      
      const dParts = dVal.split("/");
      const tParts = tVal.split(":");
      
      const d = dParts[0] || "";
      const m = dParts[1] || "";
      const y = dParts[2] || "";
      const hh = tParts[0] || "";
      const mm = tParts[1] || "";

      content = `
        <div style="background: #222; padding: 10px; display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center;">
            <div style="display: flex; gap: 5px; align-items: center;">
                <input type="number" name="day" placeholder="DD" value="${d}" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
                <span>/</span>
                <input type="number" name="month" placeholder="MM" value="${m}" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
                <span>/</span>
                <input type="number" name="year" placeholder="YYYY" value="${y}" oninput="if(this.value.length>6)this.value=this.value.slice(0,6);" style="width: 80px; text-align: center;">
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
                <input type="number" name="hour" placeholder="HH" value="${hh}" min="0" max="23" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
                <span>:</span>
                <input type="number" name="min" placeholder="MM" value="${mm}" min="0" max="59" oninput="if(this.value.length>3)this.value=this.value.slice(0,3);" style="width: 50px; text-align: center;">
            </div>
        </div>`;

      callback = (html) => {
        const el = (name) => html.querySelector(`input[name=${name}]`).value;
        let day = el("day").padStart(2, "0") || "00";
        let month = el("month").padStart(2, "0") || "00";
        let year = el("year") || "0000";
        let hour = el("hour").padStart(2, "0") || "00";
        let min = el("min").padStart(2, "0") || "00";
        
        return `${day}/${month}/${year} ${hour}:${min}`;
      };
    }

    try {
      const result = await DialogV2.prompt({
        classes: ["timeline-builder"],
        window: { title: "Edit Timeframe", icon: "fa-solid fa-clock" },
        content: content,
        ok: {
          label: "Save",
          callback: (event, button, dialog) => callback(dialog.element)
        }
      });

      if (result !== null) {
        await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, { period: result });
        
        const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
        if (timeline?.autoSort) {
          await TimelineManager.#performSort(timeline);
        }
        
        this.render();
      }
    } catch (e) {
      // Cancelled
    }
  }

  // Drag and Drop handlers
  #onDragStart(event) {
    const entry = event.target.closest(".timeline-entry");
    entry.classList.add("dragging");
    event.dataTransfer.setData("text/plain", entry.dataset.entryId);
    event.dataTransfer.effectAllowed = "move";
  }

  #onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const entry = event.target.closest(".timeline-entry");
    if (!entry || entry.classList.contains("dragging")) return;

    const entryList = this.element.querySelector(".entry-list");
    const dragging = entryList.querySelector(".dragging");
    if (!dragging) return;

    const entries = [...entryList.querySelectorAll(".timeline-entry:not(.dragging)")];
    const nextEntry = entries.find(e => {
      const rect = e.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });

    if (nextEntry) {
      entryList.insertBefore(dragging, nextEntry);
    } else {
      entryList.appendChild(dragging);
    }
  }

  async #onDrop(event) {
    event.preventDefault();

    const entryList = this.element.querySelector(".entry-list");
    const entries = [...entryList.querySelectorAll(".timeline-entry")];
    const orderedIds = entries.map(e => e.dataset.entryId);

    if (this.#selectedTimelineId) {
      await TimelineStore.updateEntryOrder(this.#selectedTimelineId, orderedIds);
    }
  }

  #onDragEnd(event) {
    const entry = event.target.closest(".timeline-entry");
    entry?.classList.remove("dragging");
  }

  // Action handlers
  static async #onCreateTimeline(event, target) {
    const result = await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "New Timeline" },
      content: `<div style="background: #222; padding: 10px;"><input type="text" name="name" placeholder="Timeline name" maxlength="25" autofocus style="width: 100%; box-sizing: border-box;"></div>`,
      ok: {
        label: "Create",
        callback: (event, button, dialog) => dialog.element.querySelector("input[name=name]").value.trim()
      }
    });

    if (result !== null) {
      let name = result;
      if (!name) {
        const timelines = TimelineStore.getTimelines();
        name = "New Timeline";
        let counter = 1;
        while (timelines.some(t => t.name === name)) {
          name = `New Timeline ${counter}`;
          counter++;
        }
      }

      const timeline = await TimelineStore.createTimeline(name);
      this.#selectedTimelineId = timeline.id;
      this.render();
    }
  }

  static async #onConfigureTimeline(event, target) {
    event.stopPropagation();
    const timelineId = target.dataset.timelineId;
    const timeline = TimelineStore.getTimeline(timelineId);
    if (!timeline) return;

    const colors = [
      ...[...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label))
    ];
    
    const effects = [
      { value: "none", label: "None" },
      { value: "glow", label: "Glow (Light)" },
      { value: "glow-strong", label: "Glow (Strong)" },
      { value: "float", label: "Float" },
      { value: "shake", label: "Shake" },
      { value: "pulse", label: "Pulse" },
      { value: "glitch", label: "Glitch" }
    ];

    const timeframeModes = [
      { value: "free", label: "Free (Text)" },
      { value: "date", label: "Date (DD/MM/YYYY)" },
      { value: "date_my", label: "Date (MM/YYYY)" },
      { value: "datetime", label: "Date & Time (DD/MM/YYYY HH:MM)" },
      { value: "hour", label: "Time (HH:MM:SS)" },
      { value: "hour2", label: "Time (HH:MM)" }
    ];

    const lineStyles = [
      { value: "solid", label: "Solid" },
      { value: "dashed", label: "Dashed" },
      { value: "rough", label: "Rough / Ink" }
    ];

    const lineEffects = [
      { value: "none", label: "None" },
      { value: "flow", label: "Flow" },
      { value: "pulse", label: "Pulse" },
      { value: "glitch", label: "Glitch" },
      { value: "neon", label: "Neon Flicker" },
      { value: "chroma", label: "Chroma / Spectrum" }
    ];

    const dotSizes = [
      { value: "8", label: "Small (8px)" },
      { value: "12", label: "Default (12px)" },
      { value: "16", label: "Large (16px)" },
      { value: "20", label: "Extra Large (20px)" }
    ];

    const dotShapes = [
      { value: "default", label: "Ring" },
      { value: "filled-circle", label: "Filled Circle" },
      { value: "square", label: "Square" },
      { value: "filled-square", label: "Filled Square" }
    ];

    const colorOptions = colors.map(c =>
      `<option value="${c.value}" ${c.value === (timeline.defaultColor || "") ? "selected" : ""}>${c.label}</option>`
    ).join("");

    const effectOptions = effects.map(e =>
      `<option value="${e.value}" ${e.value === (timeline.defaultEffect || "none") ? "selected" : ""}>${e.label}</option>`
    ).join("");

    const modeOptions = timeframeModes.map(m =>
      `<option value="${m.value}" ${m.value === (timeline.timeframeMode || "free") ? "selected" : ""}>${m.label}</option>`
    ).join("");

    const lineColorOptions = `<option value="" ${!timeline.lineColor ? "selected" : ""}>Default</option>` +
      colors.map(c =>
        `<option value="${c.value}" ${c.value === (timeline.lineColor || "") ? "selected" : ""}>${c.label}</option>`
      ).join("");

    const lineStyleOptions = lineStyles.map(s =>
      `<option value="${s.value}" ${s.value === (timeline.lineStyle || "solid") ? "selected" : ""}>${s.label}</option>`
    ).join("");

    const lineEffectOptions = lineEffects.map(e =>
      `<option value="${e.value}" ${e.value === (timeline.lineEffect || "none") ? "selected" : ""}>${e.label}</option>`
    ).join("");

    const dotSizeOptions = dotSizes.map(s =>
      `<option value="${s.value}" ${String(s.value) === String(timeline.dotSize || "12") ? "selected" : ""}>${s.label}</option>`
    ).join("");

    const dotShapeOptions = dotShapes.map(s =>
      `<option value="${s.value}" ${s.value === (timeline.dotShape || "default") ? "selected" : ""}>${s.label}</option>`
    ).join("");

    const wrapper = document.createElement("div");
    const content = document.createElement("div");
    content.style.cssText = "background: #222; padding: 10px; display: flex; flex-direction: column; gap: 10px;";
    wrapper.appendChild(content);
    content.innerHTML = `
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Timeframe Mode</label>
          <select name="timeframeMode" style="width: 100%; box-sizing: border-box;">${modeOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" name="autoSort" ${timeline.autoSort ? "checked" : ""}>
              <span>Auto Sort</span>
          </label>
          <p style="color: #aaa; margin: 5px 0 0 24px;">Automatically sort entries when the timeframe is updated.</p>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Default Entry Color</label>
          <select name="defaultColor" style="width: 100%; box-sizing: border-box;">${colorOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Default Entry Effect</label>
          <select name="defaultEffect" style="width: 100%; box-sizing: border-box;">${effectOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Background Image</label>
          <div style="display: flex; gap: 5px; align-items: center;">
              <input type="text" name="backgroundImage" value="${timeline.backgroundImage || ""}" placeholder="path/to/image.webp" style="flex: 1;">
              <button type="button" data-action="pickImage" style="width: 32px; height: 26px; display: flex; align-items: center; justify-content: center; background: #444; border: 1px solid #666; color: #fff; cursor: pointer; border-radius: 3px;">
                  <i class="fa-solid fa-file-import"></i>
              </button>
          </div>
      </div>
      <hr style="border: none; border-top: 1px solid #444; margin: 5px 0;">
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Main Line Width</label>
          <select name="lineWidth" style="width: 100%; box-sizing: border-box;">
              <option value="1" ${(timeline.lineWidth || 2) == 1 ? "selected" : ""}>1 px</option>
              <option value="2" ${(timeline.lineWidth || 2) == 2 ? "selected" : ""}>2 px</option>
          </select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Main Line Color</label>
          <select name="lineColor" style="width: 100%; box-sizing: border-box;">${lineColorOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Main Line Style</label>
          <select name="lineStyle" style="width: 100%; box-sizing: border-box;">${lineStyleOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Main Line Effect</label>
          <select name="lineEffect" style="width: 100%; box-sizing: border-box;">${lineEffectOptions}</select>
      </div>
      <hr style="border: none; border-top: 1px solid #444; margin: 5px 0;">
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Dot Size</label>
          <select name="dotSize" style="width: 100%; box-sizing: border-box;">${dotSizeOptions}</select>
      </div>
      <div class="form-group">
          <label style="display: block; margin-bottom: 4px; white-space: nowrap;">Dot Shape</label>
          <select name="dotShape" style="width: 100%; box-sizing: border-box;">${dotShapeOptions}</select>
      </div>`;

    const result = await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: `Settings: ${timeline.name}`, icon: "fa-solid fa-gear" },
      content: wrapper,
      actions: {
        pickImage: async (event, target) => {
            const input = target.closest(".form-group").querySelector("input[name=backgroundImage]");
            const fp = new foundry.applications.apps.FilePicker({
                type: "image",
                callback: (path) => { input.value = path; }
            });
            await fp.browse();
        }
      },
      ok: {
        label: "Save",
        callback: (event, button, dialog) => {
            return {
                timeframeMode: dialog.element.querySelector("select[name=timeframeMode]").value,
                autoSort: dialog.element.querySelector("input[name=autoSort]").checked,
                defaultColor: dialog.element.querySelector("select[name=defaultColor]").value,
                defaultEffect: dialog.element.querySelector("select[name=defaultEffect]").value,
                backgroundImage: dialog.element.querySelector("input[name=backgroundImage]").value,
                lineWidth: parseInt(dialog.element.querySelector("select[name=lineWidth]").value) || 2,
                lineColor: dialog.element.querySelector("select[name=lineColor]").value,
                lineStyle: dialog.element.querySelector("select[name=lineStyle]").value,
                lineEffect: dialog.element.querySelector("select[name=lineEffect]").value,
                dotSize: parseInt(dialog.element.querySelector("select[name=dotSize]").value) || 12,
                dotShape: dialog.element.querySelector("select[name=dotShape]").value
            };
        }
      }
    });

    if (result) {
      await TimelineStore.updateTimeline(timelineId, result);
      this.render();
    }
  }

  static async #onManageTags(event, target) {
    new TagManager().render(true);
  }

  static async #onManageColors(event, target) {
    new ColorManager().render(true);
  }

  static async #onOpenViewer(event, target) {
    if (this.#selectedTimelineId) {
      Timeline.Open(this.#selectedTimelineId);
    }
  }

  static async #onBroadcastTimeline(event, target) {
    if (!this.#selectedTimelineId) return;
    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    if (!timeline) return;
    if (!timeline.visible) {
      await TimelineStore.updateTimeline(this.#selectedTimelineId, { visible: true });
    }
    await game.settings.set(MODULE_ID, SETTINGS.BROADCAST, {
      timelineId: this.#selectedTimelineId,
      timestamp: Date.now()
    });
    this.render();
  }

  static async #onManagePermissions(event, target) {
    const timelineId = target.dataset.timelineId;
    if (timelineId) {
      new PermissionManager(timelineId).render(true);
    }
  }

  static async #onSelectTimeline(event, target) {
    const timelineId = target.dataset.timelineId;
    this.#selectedTimelineId = timelineId;
    this.render();
  }

  static async #performSort(timeline) {
    const mode = timeline.timeframeMode || "free";
    
    // Helper to get comparable value
    const getSortValue = (period) => {
      const p = period || "";
      if (!p) return "";
      
      if (mode === "date") { // DD/MM/YYYY
          const parts = p.split("/");
          if (parts.length !== 3) return p;
          return `${parts[2].padStart(10, "0")}${parts[1]}${parts[0]}`;
      }
      if (mode === "date_my") { // MM/YYYY
          const parts = p.split("/");
          if (parts.length !== 2) return p;
          return `${parts[1].padStart(10, "0")}${parts[0]}`;
      }
      if (mode === "datetime") { // DD/MM/YYYY HH:MM
          const [d, t] = p.split(" ");
          if (!d || !t) return p;
          const dParts = d.split("/");
          const tParts = t.split(":");
          if (dParts.length !== 3 || tParts.length !== 2) return p;
          return `${dParts[2].padStart(10, "0")}${dParts[1]}${dParts[0]}${tParts[0]}${tParts[1]}`;
      }
      if (mode === "hour" || mode === "hour2") {
          return p.replace(/:/g, "");
      }
      return p.toLowerCase();
    };

    const entries = [...timeline.entries];
    entries.sort((a, b) => {
      const valA = getSortValue(a.period);
      const valB = getSortValue(b.period);
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const orderedIds = entries.map(e => e.id);
    await TimelineStore.updateEntryOrder(timeline.id, orderedIds);
  }

  static async #onSortTimeline(event, target) {
    const timelineId = target.dataset.timelineId;
    const timeline = TimelineStore.getTimeline(timelineId);
    if (!timeline) return;

    const confirmed = await DialogV2.confirm({
      classes: ["timeline-builder"],
      window: { title: "Sort Timeline" },
      content: `<div style="background: #222; padding: 10px;">
        <p>Are you sure you want to sort all entries in "<strong>${timeline.name}</strong>"?</p>
        <p>Sorting is based on the current Timeframe Mode (<strong>${timeline.timeframeMode || "free"}</strong>).</p>
        <p style="color: #ff6b6b; margin-top: 10px;"><i class="fa-solid fa-triangle-exclamation"></i> This action cannot be undone.</p>
      </div>`,
      yes: { label: "Sort", icon: "fa-solid fa-sort" },
      no: { label: "Cancel" }
    });

    if (confirmed) {
      await TimelineManager.#performSort(timeline);
      this.render();
    }
  }

  static async #onDeleteTimeline(event, target) {
    const timelineId = target.dataset.timelineId;
    const timeline = TimelineStore.getTimeline(timelineId);
    if (!timeline) return;

    const confirmed = await DialogV2.confirm({
      classes: ["timeline-builder"],
      window: { title: "Delete Timeline" },
      content: `<div style="background: #222; padding: 10px;"><p>Are you sure you want to delete "<strong>${timeline.name}</strong>"?</p>
                <p>This action cannot be undone.</p></div>`,
      yes: { label: "Delete", icon: "fa-solid fa-trash" },
      no: { label: "Cancel" }
    });

    if (confirmed) {
      await TimelineStore.deleteTimeline(timelineId);
      if (this.#selectedTimelineId === timelineId) {
        this.#selectedTimelineId = null;
      }
      this.render();
    }
  }

  static async #onToggleVisibility(event, target) {
    const timelineId = target.dataset.timelineId;
    const timeline = TimelineStore.getTimeline(timelineId);
    if (!timeline) return;

    await TimelineStore.updateTimeline(timelineId, { visible: !timeline.visible });
    this.render();
  }

  static async #onAddEntry(event, target) {
    if (!this.#selectedTimelineId) return;

    await TimelineStore.addEntry(this.#selectedTimelineId, {
      name: "New Entry",
      period: "",
      description: "",
      effect: "default"
    });

    this.render();
  }

  static async #onDeleteEntry(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const confirmed = await DialogV2.confirm({
      classes: ["timeline-builder"],
      window: { title: "Delete Entry" },
      content: `<div style="background: #222; padding: 10px;"><p>Are you sure you want to delete this entry?</p></div>`,
      yes: { label: "Delete", icon: "fa-solid fa-trash" },
      no: { label: "Cancel" }
    });

    if (confirmed) {
      await TimelineStore.deleteEntry(this.#selectedTimelineId, entryId);
      this.render();
    }
  }

  static async #onToggleEntryVisibility(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    if (!entry) return;

    await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
      hidden: !entry.hidden
    });
    this.render();
  }

  static async #onSaveTimeline(event, target) {
    ui.notifications.info("Timeline saved successfully!");
  }

  static async #onMoveEntryUp(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    if (!timeline) return;

    const currentIndex = timeline.entries.findIndex(e => e.id === entryId);
    if (currentIndex <= 0) return;

    const orderedIds = timeline.entries.map(e => e.id);
    [orderedIds[currentIndex - 1], orderedIds[currentIndex]] = [orderedIds[currentIndex], orderedIds[currentIndex - 1]];

    await TimelineStore.updateEntryOrder(this.#selectedTimelineId, orderedIds);
    this.render();
  }

  static async #onMoveEntryDown(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    if (!timeline) return;

    const currentIndex = timeline.entries.findIndex(e => e.id === entryId);
    if (currentIndex === -1 || currentIndex >= timeline.entries.length - 1) return;

    const orderedIds = timeline.entries.map(e => e.id);
    [orderedIds[currentIndex], orderedIds[currentIndex + 1]] = [orderedIds[currentIndex + 1], orderedIds[currentIndex]];

    await TimelineStore.updateEntryOrder(this.#selectedTimelineId, orderedIds);
    this.render();
  }

  static async #onPickImage(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const filePicker = new foundry.applications.apps.FilePicker({
      type: "image",
      callback: async path => {
        await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
          img: path
        });
        this.render();
        TimelineManager.#onAdjustImageFocus.call(this, null, { dataset: { entryId } });
      }
    });
    await filePicker.browse();
  }

  static async #onAdjustImageFocus(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    
    if (!entry || !entry.img) {
      ui.notifications.warn("This entry has no image to adjust.");
      return;
    }

    const currentX = entry.imgPosition?.x ?? 50;
    const currentY = entry.imgPosition?.y ?? 50;

    // HTML content for the dialog
    const content = `
      <div style="background: #111; padding: 10px; text-align: center;">
        <p style="color: #ccc; font-size: 12px; margin-bottom: 8px;">Click on the point of interest in the image.</p>
        <div class="focus-picker-container" style="position: relative; display: inline-block; cursor: crosshair; max-width: 100%; border: 1px solid #444;">
          <img src="${entry.img}" style="display: block; max-width: 100%; max-height: 400px; pointer-events: none;">
          <div class="focus-point" style="
              position: absolute; 
              left: ${currentX}%; 
              top: ${currentY}%; 
              width: 20px; 
              height: 20px; 
              border: 2px solid #ff0000; 
              border-radius: 50%; 
              transform: translate(-50%, -50%); 
              box-shadow: 0 0 4px rgba(0,0,0,0.8);
              pointer-events: none;
              background: rgba(255, 255, 255, 0.3);">
          </div>
          <!-- Invisible overlay to capture clicks -->
          <div class="click-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
        </div>
        <div style="margin-top: 8px; font-family: monospace; color: #888;">
          X: <span id="focus-x">${currentX}</span>% | Y: <span id="focus-y">${currentY}</span>%
        </div>
      </div>`;

    let newPos = { x: currentX, y: currentY };

    await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Adjust Image Focus", icon: "fa-solid fa-crop-simple" },
      content: content,
      render: (event, dialog) => {
        const container = dialog.element.querySelector(".focus-picker-container");
        const overlay = container.querySelector(".click-overlay");
        const point = container.querySelector(".focus-point");
        const labelX = dialog.element.querySelector("#focus-x");
        const labelY = dialog.element.querySelector("#focus-y");

        overlay.addEventListener("click", (e) => {
          const rect = container.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
          
          newPos = { x: Math.round(x), y: Math.round(y) };
          
          point.style.left = `${newPos.x}%`;
          point.style.top = `${newPos.y}%`;
          labelX.textContent = newPos.x;
          labelY.textContent = newPos.y;
        });
      },
      ok: {
        label: "Save Focus",
        callback: async () => {
          await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, { imgPosition: newPos });
          this.render();
        }
      }
    });
  }

  static async #onPickTags(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    const currentTags = new Set(entry?.tagIds || []);
    const allTags = [...TimelineStore.getTags()].sort((a, b) => a.label.localeCompare(b.label));

    if (allTags.length === 0) {
      ui.notifications.warn("No tags available. Create tags in the sidebar first.");
      return;
    }

    const chipStyle = (tag) => {
      const style = getGlassStyle(tag.color);
      return `${style} padding: 4px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; font-weight: 600; user-select: none;`;
    };

    const buildSelectedHtml = (selectedIds) => {
      const selected = allTags.filter(t => selectedIds.has(t.id));
      if (selected.length === 0) return `<p style="color: #666; font-style: italic; margin: 0; font-size: 12px;">No tags selected.</p>`;
      return selected.map(t =>
        `<span class="pick-tag-chip selected" data-tag-id="${t.id}" style="${chipStyle(t)}" title="Click to remove">
          <span>${t.label}</span>
          <i class="fa-solid fa-times" style="font-size: 10px; opacity: 0.8;"></i>
        </span>`
      ).join("");
    };

    const buildAvailableHtml = (selectedIds) => {
      const available = allTags.filter(t => !selectedIds.has(t.id));
      if (available.length === 0) return `<p style="color: #666; font-style: italic; margin: 0; font-size: 12px;">All tags selected.</p>`;
      return available.map(t =>
        `<span class="pick-tag-chip available" data-tag-id="${t.id}" style="${chipStyle(t)}" title="Click to add">
          <span>${t.label}</span>
          <i class="fa-solid fa-plus" style="font-size: 10px; opacity: 0.6;"></i>
        </span>`
      ).join("");
    };

    let content = `<div style="padding: 10px; background: #222;">
      <label style="font-size: 11px; text-transform: uppercase; color: #aaa; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Selected Tags</label>
      <div class="pick-tags-selected" style="display: flex; flex-wrap: wrap; gap: 5px; min-height: 30px; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid #333; border-radius: 4px; margin-bottom: 12px; align-content: flex-start;">
        ${buildSelectedHtml(currentTags)}
      </div>
      <label style="font-size: 11px; text-transform: uppercase; color: #aaa; letter-spacing: 0.5px; margin-bottom: 6px; display: block;">Available Tags</label>
      <div class="pick-tags-available" style="display: flex; flex-wrap: wrap; gap: 5px; min-height: 30px; max-height: 200px; overflow-y: auto; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid #333; border-radius: 4px; align-content: flex-start;">
        ${buildAvailableHtml(currentTags)}
      </div>
    </div>`;

    await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Select Tags" },
      content: content,
      ok: {
        label: "Save",
        callback: async (event, button, dialog) => {
          const chips = dialog.element.querySelectorAll(".pick-tags-selected .pick-tag-chip");
          const selectedIds = Array.from(chips).map(c => c.dataset.tagId);
          await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, { tagIds: selectedIds });
          this.render();
        }
      },
      render: (event, dialog) => {
        const selectedIds = new Set(currentTags);
        const container = dialog.element;

        const refresh = () => {
          container.querySelector(".pick-tags-selected").innerHTML = buildSelectedHtml(selectedIds);
          container.querySelector(".pick-tags-available").innerHTML = buildAvailableHtml(selectedIds);
        };

        container.addEventListener("click", (e) => {
          const chip = e.target.closest(".pick-tag-chip");
          if (!chip) return;
          const tagId = chip.dataset.tagId;
          if (chip.classList.contains("selected")) {
            selectedIds.delete(tagId);
          } else {
            selectedIds.add(tagId);
          }
          refresh();
        });
      }
    });
  }

  static async #onPickColor(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    const currentColor = entry?.color || "";

    const colors = [
      { label: "Default", value: "" },
      ...[...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label))
    ];

    const options = colors.map(c => 
      `<option value="${c.value}" ${c.value === currentColor ? "selected" : ""}>${c.label}</option>`
    ).join("");

    const color = await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Choose Color" },
      content: `<div class="form-group" style="background: #222; padding: 10px;"><label>Select Color:</label><select name="color" style="width: 100%; box-sizing: border-box;">${options}</select></div>`,
      ok: {
        label: "Choose",
        callback: (event, button, dialog) => dialog.element.querySelector("select[name=color]").value
      }
    });

    if (color !== null) {
      await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
        color: color
      });
      this.render();
    }
  }

  static async #onPickEffect(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    const currentEffect = entry?.effect || "default";
    const currentEffectColor = entry?.effectColor || "";

    const effects = [
      { value: "default", label: "Default" },
      { value: "none", label: "None" },
      { value: "glow", label: "Glow (Light)" },
      { value: "glow-strong", label: "Glow (Strong)" },
      { value: "float", label: "Float" },
      { value: "shake", label: "Shake" },
      { value: "pulse", label: "Pulse" },
      { value: "glitch", label: "Glitch" }
    ];

    const glowEffects = ["glow", "glow-strong", "glitch"];
    const colors = [...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label));

    const effectOptions = effects.map(e =>
      `<option value="${e.value}" ${e.value === currentEffect ? "selected" : ""}>${e.label}</option>`
    ).join("");

    const colorOptions = `<option value="" ${!currentEffectColor ? "selected" : ""}>Color from Timeline Settings</option>` +
      colors.map(c => `<option value="${c.value}" ${c.value === currentEffectColor ? "selected" : ""}>${c.label}</option>`).join("");

    const showColor = glowEffects.includes(currentEffect);

    const result = await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Choose Visual Effect" },
      content: `
        <div style="background: #222; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
          <div class="form-group">
            <label>Select Effect:</label>
            <select name="effect" style="width: 100%; box-sizing: border-box;" onchange="document.getElementById('effectColorGroup').style.display = ['glow','glow-strong','glitch'].includes(this.value) ? 'block' : 'none';">${effectOptions}</select>
          </div>
          <div class="form-group" id="effectColorGroup" style="display: ${showColor ? "block" : "none"};">
            <label>Effect Color:</label>
            <select name="effectColor" style="width: 100%; box-sizing: border-box;">${colorOptions}</select>
          </div>
        </div>`,
      ok: {
        label: "Choose",
        callback: (event, button, dialog) => ({
          effect: dialog.element.querySelector("select[name=effect]").value,
          effectColor: dialog.element.querySelector("select[name=effectColor]").value
        })
      }
    });

    if (result !== null) {
      const updateData = { effect: result.effect };
      updateData.effectColor = glowEffects.includes(result.effect) ? result.effectColor : "";
      await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, updateData);
      this.render();
    }
  }

  static async #onConfigureMystery(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    if (!entry) return;

    const mystery = entry.mystery || { img: false, text: false, timeframe: false };

    const result = await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Mystery Mode", icon: "fa-solid fa-mask" },
      content: `
        <div style="background: #222; padding: 15px; display: flex; flex-direction: column; gap: 12px;">
          <p style="color: #a855f7; margin: 0; font-size: 0.85rem;">
            <i class="fa-solid fa-mask"></i>
            Mystery mode hides selected content from players while showing that something exists.
          </p>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="mysteryImg" ${mystery.img ? "checked" : ""}>
            <i class="fa-solid fa-image" style="width: 16px; color: #3b9fd6;"></i>
            <span>Image</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="mysteryText" ${mystery.text ? "checked" : ""}>
            <i class="fa-solid fa-font" style="width: 16px; color: #e0a526;"></i>
            <span>Text <small style="color: #888;">(name, description & tags)</small></span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="mysteryTimeframe" ${mystery.timeframe ? "checked" : ""}>
            <i class="fa-solid fa-clock" style="width: 16px; color: #2ec4a0;"></i>
            <span>Timeframe</span>
          </label>
        </div>`,
      ok: {
        label: "Save",
        callback: (event, button, dialog) => ({
          img: dialog.element.querySelector("input[name=mysteryImg]").checked,
          text: dialog.element.querySelector("input[name=mysteryText]").checked,
          timeframe: dialog.element.querySelector("input[name=mysteryTimeframe]").checked
        })
      }
    });

    if (result !== null) {
      await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, { mystery: result });
      this.render();
    }
  }

  static async #onInsertEntry(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    await TimelineStore.insertEntry(this.#selectedTimelineId, entryId, {
      name: "New Entry",
      period: "",
      description: ""
    });

    this.render();
  }

  static async #onOpenLinkedPage(event, target) {
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    const timeline = TimelineStore.getTimeline(this.#selectedTimelineId);
    const entry = timeline?.entries.find(e => e.id === entryId);
    if (!entry?.pageUuid) return;

    try {
      const doc = await fromUuid(entry.pageUuid);
      if (!doc) return ui.notifications.warn("Linked page not found.");

      // JournalEntry (full journal) — open normally
      if (doc.pages) return doc.sheet?.render(true);

      // JournalEntryPage — show content in view mode via dialog
      let viewContent = "";
      let icon = "fa-solid fa-book-open";

      if (doc.text?.content) {
        const editor = foundry.applications?.ux?.TextEditor ?? TextEditor;
        viewContent = await editor.enrichHTML(doc.text.content, { async: true });
      } else if (doc.type === "image" && doc.src) {
        icon = "fa-solid fa-image";
        viewContent = `<div style="text-align:center;"><img src="${doc.src}" style="max-width:100%;max-height:500px;border-radius:4px;"></div>`;
      } else if (doc.type === "video" && doc.src) {
        icon = "fa-solid fa-video";
        viewContent = `<div style="text-align:center;"><video src="${doc.src}" controls style="max-width:100%;"></video></div>`;
      } else {
        return doc.sheet?.render(true);
      }

      await DialogV2.prompt({
        classes: ["timeline-builder"],
        window: { title: doc.name, icon, resizable: true },
        content: `<div style="padding:10px; max-height: 65vh; overflow-y: auto;">${viewContent}</div>`,
        ok: { label: "Close" },
        position: { width: 560 },
        render: (event, dialog) => {
          const footer = dialog.element.querySelector(".form-footer");
          if (footer) footer.style.display = "none";
        }
      }).catch(() => {});
    } catch (err) {
      console.error("Timeline Builder | Error opening linked page:", err);
      ui.notifications.error("Could not open the linked page.");
    }
  }

  static async #onRemoveLinkedPage(event, target) {
    event.stopPropagation();
    const entryId = target.dataset.entryId;
    if (!this.#selectedTimelineId || !entryId) return;

    await TimelineStore.updateEntry(this.#selectedTimelineId, entryId, {
      pageUuid: ""
    });
    this.render();
  }
}

/**
 * Dedicated Application for managing global tags.
 */
class TagManager extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "tag-manager",
    classes: ["timeline-builder"],
    window: { title: "Manage Global Tags", icon: "fa-solid fa-tags", width: 400 },
    position: { width: 400, height: "auto" }
  };

  async _renderHTML(context, options) {
    const tags = [...TimelineStore.getTags()].sort((a, b) => a.label.localeCompare(b.label));
    const colors = [...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label));
    const colorOptions = colors.map(c => `<option value="${c.value}">${c.label}</option>`).join("");

    let html = `<div style="padding: 10px; background: #222; height: 100%;">      
      <div class="tag-create-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;">
        <input type="text" id="newTagLabel" placeholder="New Tag Name" maxlength="25" style="flex: 1; height: 32px;">
        <select id="newTagColor" style="height: 32px; max-width: 120px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
          ${colorOptions}
        </select>
        <button type="button" id="addTagBtn" style="width: 40px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-plus"></i></button>
      </div>
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid #333; border-radius: 4px; padding: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #ccc;">
        <i class="fa-solid fa-circle-info" style="color: var(--tl-primary, #2ec4a0);"></i>
        <span>Click on a tag to edit its name or color.</span>
      </div>
      <div class="tag-manager-list" style="display: flex; flex-wrap: wrap; gap: 5px; min-height: 50px; max-height: 300px; overflow-y: auto; align-content: flex-start;">`;
    
    tags.forEach(t => {
      const style = getGlassStyle(t.color);
      html += `
        <div class="tag-chip" data-tag-id="${t.id}" style="${style} padding: 4px 8px; border-radius: 12px; display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;" title="Click to edit">
          <span style="font-weight: 600;">${t.label}</span>
          <i class="fa-solid fa-times" data-action="delete-tag" data-tag-id="${t.id}" style="cursor: pointer; opacity: 0.8; margin-left: 4px;"></i>
        </div>`;
    });
    
    if (tags.length === 0) html += `<p style="color: #888; width: 100%; text-align: center; font-style: italic;">No tags created yet.</p>`;
    
    html += `</div></div>`;
    
    return html;
  }

  _replaceHTML(result, content, options) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    const addBtn = this.element.querySelector("#addTagBtn");
    if (addBtn) {
      addBtn.onclick = async () => {
        const label = this.element.querySelector("#newTagLabel").value.trim();
        const color = this.element.querySelector("#newTagColor").value;
        if (label) {
          const tags = TimelineStore.getTags();
          if (tags.some(t => t.label.toLowerCase() === label.toLowerCase())) {
            ui.notifications.warn(`Tag "${label}" already exists.`);
            return;
          }
          await TimelineStore.createTag(label, color);
          this.render();
        }
      };
    }

    const list = this.element.querySelector(".tag-manager-list");
    if (list) {
      list.onclick = async (e) => {
        const target = e.target;
        if (target.dataset.action === "delete-tag") {
          e.stopPropagation();
          await TimelineStore.deleteTag(e.target.dataset.tagId);
          this.render();
          return;
        }

        const chip = target.closest(".tag-chip");
        if (chip) {
          const tagId = chip.dataset.tagId;
          const tag = TimelineStore.getTags().find(t => t.id === tagId);
          if (tag) this.#editTag(tag);
        }
      };
    }
  }

  async #editTag(tag) {
    const colors = [...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label));
    const options = colors.map(c => 
      `<option value="${c.value}" ${c.value === tag.color ? "selected" : ""}>${c.label}</option>`
    ).join("");

    const content = `
      <div style="display: flex; gap: 5px; align-items: center; padding: 10px; background: #222;">
        <input type="text" name="label" value="${tag.label}" maxlength="25" style="flex: 1;" autofocus>
        <select name="color" style="height: 32px; max-width: 120px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">${options}</select>
      </div>
    `;

    await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Edit Tag", icon: "fa-solid fa-tag" },
      content: content,
      ok: {
        label: "Save",
        callback: async (event, button, dialog) => {
          const label = dialog.element.querySelector("input[name='label']").value.trim();
          const color = dialog.element.querySelector("select[name='color']").value;

          if (!label) return;

          const tags = TimelineStore.getTags();
          const duplicate = tags.find(t => t.id !== tag.id && t.label.toLowerCase() === label.toLowerCase());
          if (duplicate) {
            ui.notifications.warn(`Tag "${label}" already exists.`);
            return;
          }

          await TimelineStore.updateTag(tag.id, { label, color });
          this.render();
        }
      }
    });
  }
}

/**
 * Dedicated Application for managing user permissions.
 */
class PermissionManager extends ApplicationV2 {
  constructor(timelineId, options = {}) {
    super(options);
    this.timelineId = timelineId;
  }

  static DEFAULT_OPTIONS = {
    id: "permission-manager",
    classes: ["timeline-builder"],
    window: { title: "User Permissions", icon: "fa-solid fa-users-gear", width: 400 },
    position: { width: 400, height: "auto" }
  };

  async _renderHTML(context, options) {
    const timeline = TimelineStore.getTimeline(this.timelineId);
    if (!timeline) return `<p>Timeline not found.</p>`;

    const users = game.users.filter(u => !u.isGM);
    const globalState = timeline.visible ? "Visible" : "Hidden";
    const globalIcon = timeline.visible ? "fa-eye" : "fa-eye-slash";
    const globalColor = timeline.visible ? "var(--tl-success)" : "var(--tl-text-muted)";

    let html = `<div style="padding: 15px; background: #222; height: 100%;">
      <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid ${globalIcon}" style="color: ${globalColor}; font-size: 1.2rem;"></i>
        <div>
          <div style="font-weight: bold;">Global Default: ${globalState}</div>
          <div style="font-size: 0.8rem; color: #888;">Users inherit this unless overridden below.</div>
        </div>
      </div>
      
      <div class="permission-list" style="display: flex; flex-direction: column; gap: 8px;">`;

    if (users.length === 0) {
      html += `<p style="font-style: italic; color: #888;">No players found.</p>`;
    }

    users.forEach(u => {
      const perm = timeline.userPermissions?.[u.id]; // undefined (default), true, or false
      const val = perm === undefined ? "default" : (perm ? "true" : "false");

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 4px;">
          <span style="font-weight: 600;">${u.name}</span>
          <select class="perm-select" data-user-id="${u.id}" style="background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 2px;">
            <option value="default" ${val === "default" ? "selected" : ""}>Default (${globalState})</option>
            <option value="true" ${val === "true" ? "selected" : ""}>Force Visible</option>
            <option value="false" ${val === "false" ? "selected" : ""}>Force Hidden</option>
          </select>
        </div>`;
    });

    html += `</div>
      <button type="button" id="savePermsBtn" style="margin-top: 15px; width: 100%; padding: 6px; background: var(--tl-primary); color: #fff; border: none; border-radius: 4px; cursor: pointer;">
        <i class="fa-solid fa-save"></i> Save Permissions
      </button>
    </div>`;

    return html;
  }

  _replaceHTML(result, content, options) {
    content.innerHTML = result;
    content.querySelector("#savePermsBtn")?.addEventListener("click", async () => {
      const selects = content.querySelectorAll(".perm-select");
      const permissions = {};
      selects.forEach(s => {
        if (s.value !== "default") permissions[s.dataset.userId] = (s.value === "true");
      });
      await TimelineStore.updateTimelinePermissions(this.timelineId, permissions);
      this.close();
    });
  }
}

/**
 * Dedicated Application for managing global colors.
 */
class ColorManager extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "color-manager",
    classes: ["timeline-builder"],
    window: { title: "Manage Global Colors", icon: "fa-solid fa-palette", width: 400 },
    position: { width: 400, height: "auto" }
  };

  async _renderHTML(context, options) {
    const colors = [...TimelineStore.getColors()].sort((a, b) => a.label.localeCompare(b.label));
    let html = `<div style="padding: 10px; background: #222; height: 100%;">      
      <div class="color-create-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;">
        <input type="text" id="newColorLabel" placeholder="New Color Name" maxlength="25" style="flex: 1; height: 32px;">
        <input type="color" id="newColorValue" value="#2ec4a0" style="width: 40px; height: 38px; padding: 0; border: none; cursor: pointer; background: none;">
        <button type="button" id="addColorBtn" style="width: 40px; height: 32px; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-plus"></i></button>
      </div>
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid #333; border-radius: 4px; padding: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #ccc;">
        <i class="fa-solid fa-circle-info" style="color: var(--tl-primary, #2ec4a0);"></i>
        <span>Click on a color to edit its name or value.</span>
      </div>
      <div class="color-manager-list" style="display: flex; flex-wrap: wrap; gap: 5px; min-height: 50px; max-height: 300px; overflow-y: auto; align-content: flex-start;">`;
    
    colors.forEach(c => {
      const style = getGlassStyle(c.value);
      html += `
        <div class="color-chip" data-color-id="${c.id}" style="${style} padding: 4px 8px; border-radius: 12px; display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;" title="Click to edit">
          <span style="font-weight: 600;">${c.label}</span>
          <i class="fa-solid fa-times" data-action="delete-color" data-color-id="${c.id}" style="cursor: pointer; opacity: 0.8; margin-left: 4px;"></i>
        </div>`;
    });
    
    if (colors.length === 0) html += `<p style="color: #888; width: 100%; text-align: center; font-style: italic;">No colors created yet.</p>`;
    
    html += `</div></div>`;
    
    return html;
  }

  _replaceHTML(result, content, options) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    const addBtn = this.element.querySelector("#addColorBtn");
    if (addBtn) {
      addBtn.onclick = async () => {
        const label = this.element.querySelector("#newColorLabel").value.trim();
        const value = this.element.querySelector("#newColorValue").value;
        if (label) {
          const colors = TimelineStore.getColors();
          if (colors.some(c => c.label.toLowerCase() === label.toLowerCase())) {
            ui.notifications.warn(`Color "${label}" already exists.`);
            return;
          }
          await TimelineStore.createColor(label, value);
          this.render();
        }
      };
    }

    const list = this.element.querySelector(".color-manager-list");
    if (list) {
      list.onclick = async (e) => {
        const target = e.target;
        if (target.dataset.action === "delete-color") {
          e.stopPropagation();
          if ([...TimelineStore.getColors()].length <= 1) {
            ui.notifications.warn("Cannot delete the last color. At least one color is required.");
            return;
          }
          await TimelineStore.deleteColor(e.target.dataset.colorId);
          this.render();
          return;
        }

        const chip = target.closest(".color-chip");
        if (chip) {
          const colorId = chip.dataset.colorId;
          const color = TimelineStore.getColors().find(c => c.id === colorId);
          if (color) this.#editColor(color);
        }
      };
    }
  }

  async #editColor(color) {
    const content = `
      <div style="display: flex; gap: 5px; align-items: center; padding: 10px; background: #222;">
        <input type="text" name="label" value="${color.label}" maxlength="25" style="flex: 1;" autofocus>
        <input type="color" name="value" value="${color.value}" style="width: 40px; height: 38px; padding: 0; border: none; cursor: pointer; background: none;">
      </div>
    `;

    await DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title: "Edit Color", icon: "fa-solid fa-palette" },
      content: content,
      ok: {
        label: "Save",
        callback: async (event, button, dialog) => {
          const label = dialog.element.querySelector("input[name='label']").value.trim();
          const value = dialog.element.querySelector("input[name='value']").value;

          if (!label) return;

          const colors = TimelineStore.getColors();
          const duplicate = colors.find(c => c.id !== color.id && c.label.toLowerCase() === label.toLowerCase());
          if (duplicate) {
            ui.notifications.warn(`Color "${label}" already exists.`);
            return;
          }

          await TimelineStore.updateColor(color.id, { label, value });
          this.render();
        }
      }
    });
  }
}
