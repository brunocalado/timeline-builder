/**
 * Timeline Builder - Viewer Application (Players/GM)
 */

import { TEMPLATES, MODULE_ID, SETTINGS } from "./config.js";
import { getGlassStyle, resolveEntryDisplayProps, resolvePageNames } from "./helpers.js";
import { BaseHandlebarsForm } from "./forms/BaseHandlebarsForm.js";

/**
 * Timeline Viewer Application for Players and GMs.
 * Horizontal layout with drag-to-scroll.
 */
export class TimelineViewer extends BaseHandlebarsForm {
  /** Currently selected timeline ID for viewing */
  #selectedTimelineId = null;
  /** Active tag filters */
  #activeFilters = new Set();
  /** Active text filter (timeframe) */
  #textFilter = "";

  constructor(options) {
    super(options);
    // Auto-refresh when timeline data changes
    this._settingHook = Hooks.on("updateSetting", (setting) => {
      if (setting.key === `${MODULE_ID}.${SETTINGS.DATA}`) {
        this.render();
      }
    });
  }

  static DEFAULT_OPTIONS = {
    id: "timeline-viewer",
    classes: ["timeline-builder", "viewer"],
    tag: "div",
    window: {
      title: "Timeline View",
      icon: "fa-solid fa-film",
      resizable: false
    },
    position: {
      width: 1200,
      height: 660
    },
    actions: {
      selectTimeline: TimelineViewer.#onSelectTimeline,
      toggleTagFilter: TimelineViewer.#onToggleTagFilter,
      clearFilters: TimelineViewer.#onClearFilters,
      openLinkedPage: TimelineViewer.#onOpenLinkedPage
    }
  };

  static PARTS = {
    viewer: {
      template: TEMPLATES.VIEWER
    }
  };

  async close(options) {
    Hooks.off("updateSetting", this._settingHook);
    return super.close(options);
  }

  /**
   * Prepare context data for rendering.
   */
  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const isGM = base.isGM;
    const timelines = this._getTimelines(!isGM);
    const tags = this._getTags();
    const tagMap = new Map(tags.map(t => [t.id, t]));

    if (!this.#selectedTimelineId && timelines.length > 0) {
      this.#selectedTimelineId = timelines[0].id;
    }

    const selectedTimeline = this.#selectedTimelineId
      ? timelines.find(t => t.id === this.#selectedTimelineId)
      : null;

    // Create a shallow copy for the view to avoid mutating the original timeline object
    // This prevents the "filtering gets stuck" issue
    const viewTimeline = selectedTimeline ? { ...selectedTimeline } : null;

    // 1. Get base entries and filter by permission (Hidden)
    let entries = [];
    if (viewTimeline?.entries) {
      entries = [...viewTimeline.entries].sort((a, b) => a.sort - b.sort);
      if (!isGM) {
        entries = entries.filter(e => !e.hidden);
      }
    }

    // 2. Collect tags present in the visible entries
    const usedTagIds = new Set();
    entries.forEach(e => {
      if (e.tagIds) e.tagIds.forEach(id => usedTagIds.add(id));
    });

    // 3. Prepare tags for filter bar (Only those used in current timeline)
    const allTags = tags
      .filter(t => usedTagIds.has(t.id))
      .map(t => ({ ...t, active: this.#activeFilters.has(t.id), glassStyle: getGlassStyle(t.color) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // 4. Mark entries as filtered (instead of removing them) so DOM has all nodes
    entries.forEach(e => {
      const matchesTags = this.#activeFilters.size === 0 || (e.tagIds || []).some(id => this.#activeFilters.has(id));
      const matchesText = !this.#textFilter || (e.period && e.period.toLowerCase().includes(this.#textFilter.toLowerCase()));
      e.isFilteredOut = !matchesTags || !matchesText;
    });

    // 6. Hydrate tags and resolve display properties
    entries.forEach(e => {
        e.tags = (e.tagIds || []).map(id => {
          const t = tagMap.get(id);
          if (!t) return null;
          return { ...t, style: getGlassStyle(t.color) };
        }).filter(t => t);

        resolveEntryDisplayProps(e, viewTimeline);

        // Resolve Mystery mode (player-side content masking)
        const m = e.mystery;
        if (!isGM && m) {
          e.mysteryText = !!m.text;
          e.mysteryImg = !!m.img;
          e.mysteryTimeframe = !!m.timeframe;
          if (m.text) {
            e.name = "";
            e.description = "";
            e.tags = [];
          }
          if (m.timeframe) {
            e.period = "";
          }
          if (m.img) {
            e.img = "";
          }
        }
      });

    // 6. Resolve page names for entries with linked pages
    await resolvePageNames(entries);

    if (viewTimeline) {
      viewTimeline.entries = entries;
    }

    return {
      ...base,
      timelines,
      selectedTimeline: viewTimeline,
      hasTimelines: timelines.length > 0,
      allTags,
      hasActiveFilters: this.#activeFilters.size > 0,
      textFilter: this.#textFilter
    };
  }

  /**
   * Setup interaction listeners (Scroll & Drag)
   */
  _onRender(context, options) {
    super._onRender(context, options);

    const container = this.element.querySelector('#timelineScrollContainer');
    if (!container) return;

    // Setup entry classes
    this.element.querySelectorAll(".h-entry").forEach(entry => {
      const date = entry.querySelector(".entry-date");
      const img = entry.querySelector(".card-img-wrapper.detached");

      if (date) entry.classList.add("has-date");
      if (img) entry.classList.add("has-image");
    });

    // Setup Live Text Filter
    const searchInput = this.element.querySelector('.filter-search-input');
    const clearBtn = this.element.querySelector('.search-clear-btn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.#textFilter = e.target.value;
        if (clearBtn) clearBtn.style.display = this.#textFilter ? "block" : "none";
        this.#applyFilters();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.#textFilter = "";
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        clearBtn.style.display = "none";
        this.#applyFilters();
      });
    }

    this.#setupBackground(context);
    this.#setupHorizontalScroll(container);
    this.#setupLightbox();
    this.#setupDragToScroll(container);
  }

  /**
   * Setup custom background (Image or Video)
   */
  #setupBackground(context) {
    const container = this.element.querySelector('.timeline-viewer-container');
    const scrollArea = this.element.querySelector('.timeline-scroll-area');
    if (!container) return;

    // Remove existing background
    const existing = container.querySelector('.custom-bg-media');
    if (existing) existing.remove();

    // Reset scroll area background
    if (scrollArea) scrollArea.style.background = '';

    const bgUrl = context.selectedTimeline?.backgroundImage;
    if (!bgUrl) return;

    const isVideo = /\.(mp4|webm|m4v)$/i.test(bgUrl);
    let el;

    if (isVideo) {
      el = document.createElement('video');
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
    } else {
      el = document.createElement('img');
    }

    el.src = bgUrl;
    el.classList.add('custom-bg-media');
    
    // Apply styles to cover container
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: '0',
      opacity: '0.5', // Slight transparency to ensure text readability
      pointerEvents: 'none'
    });

    // Insert as first child
    container.insertBefore(el, container.firstChild);

    // Make scroll area transparent so background shows through
    if (scrollArea) {
      scrollArea.style.background = 'transparent';
    }
  }

  /**
   * Apply filters directly to DOM elements to avoid re-rendering and losing focus.
   */
  #applyFilters() {
    const entries = this.element.querySelectorAll('.h-entry');
    const term = this.#textFilter.toLowerCase();
    const activeTags = this.#activeFilters;

    entries.forEach(entry => {
      const period = (entry.dataset.period || "").toLowerCase();
      // Handle tagIds which might be "id1,id2" string from handlebars
      const tagIdsStr = entry.dataset.tagIds || "";
      const tagIds = tagIdsStr ? tagIdsStr.split(",") : [];

      const matchesText = !term || period.includes(term);
      const matchesTags = activeTags.size === 0 || tagIds.some(id => activeTags.has(id));

      if (matchesText && matchesTags) {
        entry.classList.remove('filtered-out');
      } else {
        entry.classList.add('filtered-out');
      }
    });
  }

  /**
   * Convert vertical mouse wheel to horizontal scrolling.
   */
  #setupHorizontalScroll(container) {
    container.addEventListener('wheel', (evt) => {
      if (evt.deltaY !== 0) {
        evt.preventDefault();
        container.scrollLeft += evt.deltaY;
      }
    });
  }

  /**
   * Click image to view full size in lightbox overlay.
   */
  #setupLightbox() {
    this.element.querySelectorAll(".card-img-frame").forEach(frame => {
      frame.addEventListener("click", (e) => {
        e.stopPropagation();
        const img = frame.querySelector(".card-img");
        if (!img) return;

        const overlay = document.createElement("div");
        overlay.classList.add("timeline-lightbox");

        const fullImg = document.createElement("img");
        fullImg.src = img.src;
        fullImg.alt = img.alt || "";
        overlay.appendChild(fullImg);

        // Close on clicking the backdrop (not the image itself)
        overlay.addEventListener("click", (ev) => {
          if (ev.target === overlay) overlay.remove();
        });

        // Close on Escape
        const onKey = (ev) => {
          if (ev.key === "Escape") {
            overlay.remove();
            document.removeEventListener("keydown", onKey);
          }
        };
        document.addEventListener("keydown", onKey);

        document.body.appendChild(overlay);
      });
    });
  }

  /**
   * Enable click-and-drag horizontal scrolling for the timeline container.
   */
  #setupDragToScroll(container) {
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      container.classList.add('active');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.classList.remove('active');
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      container.classList.remove('active');
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
    });
  }

  // Action handlers
  static async #onSelectTimeline(event, target) {
    const timelineId = target.dataset.timelineId;
    if (this.#selectedTimelineId !== timelineId) {
      this.#activeFilters.clear();
    }
    this.#selectedTimelineId = timelineId;
    this.render();
  }

  static async #onToggleTagFilter(event, target) {
    const tagId = target.dataset.tagId;
    if (this.#activeFilters.has(tagId)) {
      this.#activeFilters.delete(tagId);
    } else {
      this.#activeFilters.add(tagId);
    }
    this.render();
  }

  static async #onClearFilters(event, target) {
    this.#activeFilters.clear();
    this.render();
  }

  static async #onOpenLinkedPage(event, target) {
    const uuid = target.dataset.pageUuid;
    if (!uuid) return;

    try {
      const doc = await fromUuid(uuid);
      if (!doc) return this._notifyWarning("Linked page not found.");

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

      await this._promptDialog(doc.name, `<div style="padding:10px; max-height: 65vh; overflow-y: auto;">${viewContent}</div>`, {
        icon,
        okLabel: "Close",
        position: { width: 560 },
        window: { resizable: true },
        render: (event, dialog) => {
          const footer = dialog.element.querySelector(".form-footer");
          if (footer) footer.style.display = "none";
        }
      }).catch(() => {});
    } catch (err) {
      console.error("Timeline Builder | Error opening linked page:", err);
      this._notifyError("Could not open the linked page.");
    }
  }

  /**
   * Select a specific timeline to view.
   * @param {string} timelineId
   */
  selectTimeline(timelineId) {
    this.#selectedTimelineId = timelineId;
    this.render();
  }
}
