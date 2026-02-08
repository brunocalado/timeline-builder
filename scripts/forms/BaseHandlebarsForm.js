/**
 * Timeline Builder - Base Handlebars Form
 * Base class for applications that use Handlebars templates (PARTS).
 * Extends BaseTimelineForm with HandlebarsApplicationMixin.
 *
 * @see FORM_ARCHITECTURE.md for the full inheritance diagram.
 */

import { BaseTimelineForm } from "./BaseTimelineForm.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class BaseHandlebarsForm extends HandlebarsApplicationMixin(BaseTimelineForm) {

  /**
   * Base context available to all Handlebars forms.
   * Child classes should call this via super and merge their own data.
   *
   * @example
   * async _prepareContext(options) {
   *   return {
   *     ...await super._prepareContext(options),
   *     myData: "value"
   *   };
   * }
   */
  async _prepareContext(options) {
    return {
      isGM: game.user.isGM,
      userAvatar: game.user.avatar
    };
  }
}
