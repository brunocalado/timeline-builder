/**
 * Timeline Builder - Base CRUD Form
 * Base class for simple applications that render inline HTML (_renderHTML)
 * instead of Handlebars templates. Provides shared UI building blocks
 * for create-row, info-banner, empty-state, and content-wrapper patterns.
 *
 * @see FORM_ARCHITECTURE.md for the full inheritance diagram.
 */

import { BaseTimelineForm } from "./BaseTimelineForm.js";

export class BaseCRUDForm extends BaseTimelineForm {

  static DEFAULT_OPTIONS = {
    ...BaseTimelineForm.DEFAULT_OPTIONS,
    position: { width: 400, height: "auto" }
  };

  /**
   * Standard _replaceHTML: just set innerHTML.
   * Override in child if you need to attach listeners here instead of _onRender.
   */
  _replaceHTML(result, content, options) {
    content.innerHTML = result;
  }

  // ── UI Building Blocks ────────────────────────────────────

  /**
   * Wrap content in the standard CRUD form container.
   * @param {string} inner - HTML string.
   * @returns {string}
   */
  _wrapContent(inner) {
    return `<div style="padding: 10px; background: #222; height: 100%;">${inner}</div>`;
  }

  /**
   * Build an info banner with an icon and message.
   * @param {string} message - Text to display.
   * @returns {string}
   */
  _buildInfoBanner(message) {
    return `
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid #333; border-radius: 4px; padding: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #ccc;">
        <i class="fa-solid fa-circle-info" style="color: var(--tl-primary, #2ec4a0);"></i>
        <span>${message}</span>
      </div>`;
  }

  /**
   * Build an empty-state placeholder.
   * @param {string} message - Text to display.
   * @returns {string}
   */
  _buildEmptyState(message) {
    return `<p style="color: #888; width: 100%; text-align: center; font-style: italic;">${message}</p>`;
  }

  /**
   * Build a create-row with text input, optional color selector, and add button.
   * @param {object} cfg
   * @param {string} cfg.inputId       - id for the text input.
   * @param {string} cfg.buttonId      - id for the add button.
   * @param {string} cfg.placeholder   - Placeholder text.
   * @param {string} [cfg.colorId]     - id for the color <select>. Omit to skip color picker.
   * @returns {string}
   */
  _buildCreateRow({ inputId, buttonId, placeholder, colorId }) {
    let colorSelect = "";
    if (colorId) {
      const colors = this._getColors().sort((a, b) => a.label.localeCompare(b.label));
      const opts = colors.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
      colorSelect = `<select id="${colorId}" class="tl-combobox" style="max-width: 120px;">${opts}</select>`;
    }

    return `
      <div class="create-row" style="display: flex; gap: 5px; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;">
        <input type="text" id="${inputId}" placeholder="${placeholder}" maxlength="25" style="flex: 1; height: 32px;">
        ${colorSelect}
        <button type="button" id="${buttonId}" style="width: 40px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>`;
  }

  /**
   * Build a chip list container (flex-wrap, scrollable).
   * @param {string} className - CSS class for the list div.
   * @param {string} inner     - HTML for the chips.
   * @returns {string}
   */
  _buildChipList(className, inner) {
    return `
      <div class="${className}" style="display: flex; flex-wrap: wrap; gap: 5px; min-height: 50px; max-height: 300px; overflow-y: auto; align-content: flex-start;">
        ${inner}
      </div>`;
  }

  /**
   * Build a single glass-morphism chip.
   * @param {object} cfg
   * @param {string} cfg.id        - Data id for the chip (e.g., tag id or color id).
   * @param {string} cfg.label     - Display label.
   * @param {string} cfg.color     - Hex color for glass style.
   * @param {string} cfg.dataAttr  - data-* attribute name (e.g., "tag-id" or "color-id").
   * @param {string} cfg.deleteAction - data-action value for the delete icon.
   * @returns {string}
   */
  _buildChip({ id, label, color, dataAttr, deleteAction }) {
    const style = this._getGlassStyle(color);
    return `
      <div class="${dataAttr.replace("-id", "")}-chip" data-${dataAttr}="${id}" style="${style} padding: 4px 8px; border-radius: 12px; display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;" title="Click to edit">
        <span style="font-weight: 600;">${label}</span>
        <i class="fa-solid fa-times" data-action="${deleteAction}" data-${dataAttr}="${id}" style="cursor: pointer; opacity: 0.8; margin-left: 4px;"></i>
      </div>`;
  }
}
