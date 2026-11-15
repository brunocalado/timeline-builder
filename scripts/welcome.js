/**
 * Timeline Builder - Welcome Screen
 */
import { MODULE_ID, TEMPLATES } from "./config.js";
import { BaseHandlebarsForm } from "./forms/BaseHandlebarsForm.js";
import { InstructionsForm } from "./forms/instructions-form.js";

export class TimelineWelcome extends BaseHandlebarsForm {
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

  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;

    // Action: Start & Never Show Again
    html.querySelector('[data-action="startSetup"]')?.addEventListener("click", () => {
      game.settings.set(MODULE_ID, "welcomeScreenShown", true);
      if (globalThis.Timeline?.Manage) globalThis.Timeline.Manage();
      this.close();
    });

    // Action: Open Instructions
    html.querySelector('[data-action="openInstructions"]')?.addEventListener("click", () => {
      new InstructionsForm().render(true);
    });
  }
}
