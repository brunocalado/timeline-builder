/**
 * Timeline Builder - Base Form Class
 * Abstract base class for all Timeline Builder applications.
 * Provides common functionality: styling, notifications, store access, and dialog helpers.
 *
 * @see FORM_ARCHITECTURE.md for the full inheritance diagram.
 */

import { TimelineStore } from "../store.js";
import { getGlassStyle } from "../helpers.js";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

export class BaseTimelineForm extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    classes: ["timeline-builder"],
    window: {
      icon: "fa-solid fa-clock-rotate-left",
      resizable: true
    }
  };

  // ── Render Lifecycle ──────────────────────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._injectGhostScrollStyles();
  }

  /**
   * Inject ghost scrollbar styles globally (once).
   * Uses !important to override Foundry defaults for all .timeline-builder descendants.
   */
  _injectGhostScrollStyles() {
    if (document.getElementById("timeline-ghost-scroll-styles")) return;

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

  // ── Notification Helpers ──────────────────────────────────

  _notifyInfo(message) {
    ui.notifications.info(message);
  }

  _notifyWarning(message) {
    ui.notifications.warn(message);
  }

  _notifyError(message) {
    ui.notifications.error(message);
  }

  // ── Dialog Helpers ────────────────────────────────────────

  /**
   * Show a confirmation dialog styled with Timeline Builder classes.
   * @param {string} title - Dialog window title.
   * @param {string} content - HTML content for the dialog body.
   * @param {object} [opts] - Extra options forwarded to DialogV2.confirm.
   * @returns {Promise<boolean>}
   */
  async _confirmDialog(title, content, opts = {}) {
    return DialogV2.confirm({
      classes: ["timeline-builder"],
      window: { title, icon: opts.icon },
      content: `<div class="dialog-content">${content}</div>`,
      ...opts
    });
  }

  /**
   * Show a prompt dialog styled with Timeline Builder classes.
   * @param {string} title - Dialog window title.
   * @param {string} content - HTML content for the dialog body.
   * @param {object} [opts] - Extra options forwarded to DialogV2.prompt (ok, icon, etc.).
   * @returns {Promise<*>}
   */
  async _promptDialog(title, content, opts = {}) {
    return DialogV2.prompt({
      classes: ["timeline-builder"],
      window: { title, icon: opts.icon },
      content,
      ok: { label: opts.okLabel || "Save", ...opts.ok },
      ...opts
    });
  }

  // ── Store Shortcuts ───────────────────────────────────────

  get _store() {
    return TimelineStore;
  }

  _getTimelines(onlyVisible = false) {
    return TimelineStore.getTimelines(onlyVisible);
  }

  _getTimeline(id) {
    return TimelineStore.getTimeline(id);
  }

  _getTags() {
    return TimelineStore.getTags();
  }

  _getColors() {
    return TimelineStore.getColors();
  }

  // ── Style Helpers ─────────────────────────────────────────

  _getGlassStyle(color) {
    return getGlassStyle(color);
  }
}
