/**
 * Timeline Builder - Welcome Screen
 */
import { MODULE_ID, TEMPLATES } from "./config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TimelineWelcome extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "timeline-welcome",
    classes: ["timeline-builder", "welcome-window"],
    tag: "aside",
    window: { title: "⏳ Timeline Builder", resizable: false, controls: [] },
    position: { width: 350, height: "auto" }
  };

  static PARTS = {
    content: { template: TEMPLATES.WELCOME }
  };

  async _prepareContext() {
    return {
      journalUuid: "Compendium.timeline-builder.journal.JournalEntry.nmEPLrplwb6WaVdc.JournalEntryPage.jv3upaYcDplYSzm0"
    };
  }

  _onRender(context, options) {
    const html = this.element;
    
    // Action: Start & Never Show Again
    html.querySelector('[data-action="startSetup"]')?.addEventListener("click", () => {
      game.settings.set(MODULE_ID, "welcomeScreenShown", true);
      if (globalThis.Timeline?.Manage) globalThis.Timeline.Manage();
      this.close();
    });

    // Action: Open Journal
    html.querySelector('[data-action="openJournal"]')?.addEventListener("click", async (ev) => {
      const uuid = ev.currentTarget.dataset.uuid;
      const entry = await fromUuid(uuid);
      if (entry?.sheet) entry.sheet.render(true);
    });
  }
}