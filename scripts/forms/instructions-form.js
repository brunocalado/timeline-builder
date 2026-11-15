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
