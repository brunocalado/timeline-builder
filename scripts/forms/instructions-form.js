/*!
 * ⏳ Timeline Builder
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - Instructions Application
 * The module's instructions, opened from Configure Settings and from the welcome screen.
 *
 * Why it is built this way (alternatives that were weighed and lost):
 * - A journal compendium (what shipped before): a second copy of the text drifts from the code, and
 *   a LevelDB pack is locked by any running Foundry that has the module enabled.
 * - Open to players too: the text is GM-facing (Manager, permissions, hidden entries); players have
 *   the viewer, which needs no manual. Import / Export is restricted for the same reason.
 * - A DialogV2 built from an HTML string: windows live in scripts/forms/ with their own template,
 *   and a template is editable as HTML where a string literal is not.
 * - Localized through lang/: the module has no lang/ and hard-codes its strings.
 * - A Markdown file rendered at runtime: needs a parser Foundry does not give a module.
 * - A singleton guard: ApplicationV2 replaces the element with the same id, so opening it twice
 *   already leaves one window.
 */

import { TEMPLATES } from "../config.js";
import { BaseHandlebarsForm } from "./BaseHandlebarsForm.js";

export class InstructionsForm extends BaseHandlebarsForm {
  static DEFAULT_OPTIONS = {
    id: "timeline-instructions",
    classes: ["timeline-builder", "instructions"],
    window: { title: "Timeline Builder — Instructions", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 560, height: 640 }
  };

  static PARTS = {
    content: { template: TEMPLATES.INSTRUCTIONS }
  };
}
