/**
 * Timeline Builder - Data Abstraction Layer
 */

import { MODULE_ID, SETTINGS } from "./config.js";

/**
 * Static class to centralize data manipulation for timelines.
 */
export class TimelineStore {
  /**
   * Get all timelines from settings.
   * @param {boolean} onlyVisible - If true, returns only visible timelines.
   * @returns {Array} Array of timeline objects.
   */
  static getTimelines(onlyVisible = false) {
    const timelines = game.settings.get(MODULE_ID, SETTINGS.DATA) || [];
    if (onlyVisible) {
      const userId = game.user.id;
      return timelines.filter(t => {
        // Check specific permission if it exists (true/false), otherwise fallback to global visible
        if (t.userPermissions && typeof t.userPermissions[userId] === "boolean") {
          return t.userPermissions[userId];
        }
        return t.visible;
      });
    }
    return timelines;
  }

  /**
   * Get a single timeline by ID.
   * @param {string} id - Timeline ID.
   * @returns {Object|null} Timeline object or null.
   */
  static getTimeline(id) {
    const timelines = this.getTimelines();
    return timelines.find(t => t.id === id) || null;
  }

  /**
   * Get all global tags.
   * @returns {Array} Array of tag objects {id, label, color}.
   */
  static getTags() {
    return game.settings.get(MODULE_ID, SETTINGS.TAGS) || [];
  }

  /**
   * Create a new global tag.
   */
  static async createTag(label, color) {
    const tags = this.getTags();
    const newTag = { id: foundry.utils.randomID(), label, color };
    tags.push(newTag);
    await game.settings.set(MODULE_ID, SETTINGS.TAGS, tags);
    return newTag;
  }

  /**
   * Update a global tag.
   */
  static async updateTag(id, data) {
    const tags = this.getTags();
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) return null;

    tags[index] = { ...tags[index], ...data };
    await game.settings.set(MODULE_ID, SETTINGS.TAGS, tags);
    return tags[index];
  }

  /**
   * Get all global colors.
   */
  static getColors() {
    return game.settings.get(MODULE_ID, SETTINGS.COLORS) || [];
  }

  /**
   * Create a new global color.
   */
  static async createColor(label, value) {
    const colors = this.getColors();
    const newColor = { id: foundry.utils.randomID(), label, value };
    colors.push(newColor);
    await game.settings.set(MODULE_ID, SETTINGS.COLORS, colors);
    return newColor;
  }

  /**
   * Update a global color.
   */
  static async updateColor(id, data) {
    const colors = this.getColors();
    const index = colors.findIndex(c => c.id === id);
    if (index === -1) return null;

    const oldValue = colors[index].value;

    colors[index] = { ...colors[index], ...data };
    await game.settings.set(MODULE_ID, SETTINGS.COLORS, colors);

    // Propagate color change to tags and entries if value changed
    if (data.value && data.value !== oldValue) {
      const lowerOldValue = oldValue.toLowerCase();
      const newValue = data.value;

      // Update Tags
      const tags = this.getTags();
      let tagsChanged = false;
      tags.forEach(t => {
        if (t.color && t.color.toLowerCase() === lowerOldValue) {
          t.color = newValue;
          tagsChanged = true;
        }
      });
      if (tagsChanged) {
        await game.settings.set(MODULE_ID, SETTINGS.TAGS, tags);
      }

      // Update Entries
      const timelines = this.getTimelines();
      let timelinesChanged = false;
      timelines.forEach(t => {
        if (t.defaultColor && t.defaultColor.toLowerCase() === lowerOldValue) {
          t.defaultColor = newValue;
          timelinesChanged = true;
        }

        t.entries.forEach(e => {
          if (e.color && e.color.toLowerCase() === lowerOldValue) {
            e.color = newValue;
            timelinesChanged = true;
          }
          if (e.effectColor && e.effectColor.toLowerCase() === lowerOldValue) {
            e.effectColor = newValue;
            timelinesChanged = true;
          }
        });
      });
      if (timelinesChanged) {
        await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
      }
    }

    return colors[index];
  }

  /**
   * Delete a global color.
   */
  static async deleteColor(id) {
    const colors = this.getColors().filter(c => c.id !== id);
    await game.settings.set(MODULE_ID, SETTINGS.COLORS, colors);
  }

  /**
   * Delete a global tag.
   */
  static async deleteTag(id) {
    const tags = this.getTags().filter(t => t.id !== id);
    await game.settings.set(MODULE_ID, SETTINGS.TAGS, tags);
  }

  /**
   * Create a new timeline.
   * @param {string} name - Name of the timeline.
   * @returns {Promise<Object>} The created timeline.
   */
  static async createTimeline(name) {
    const timelines = this.getTimelines();
    const newTimeline = {
      id: foundry.utils.randomID(),
      name: name || "New Timeline",
      visible: false,
      userPermissions: {},
      entries: []
    };
    timelines.push(newTimeline);
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return newTimeline;
  }

  /**
   * Update a timeline's properties.
   * @param {string} id - Timeline ID.
   * @param {Object} data - Data to update.
   * @returns {Promise<Object|null>} Updated timeline or null.
   */
  static async updateTimeline(id, data) {
    const timelines = this.getTimelines();
    const index = timelines.findIndex(t => t.id === id);
    if (index === -1) return null;

    timelines[index] = foundry.utils.mergeObject(timelines[index], data);
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return timelines[index];
  }

  /**
   * Update user permissions for a timeline.
   * @param {string} id - Timeline ID.
   * @param {Object} permissions - Map of userId -> boolean (or undefined).
   */
  static async updateTimelinePermissions(id, permissions) {
    const timelines = this.getTimelines();
    const index = timelines.findIndex(t => t.id === id);
    if (index === -1) return null;

    timelines[index].userPermissions = permissions;
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return timelines[index];
  }

  /**
   * Delete a timeline.
   * @param {string} id - Timeline ID.
   * @returns {Promise<boolean>} True if deleted.
   */
  static async deleteTimeline(id) {
    let timelines = this.getTimelines();
    const initialLength = timelines.length;
    timelines = timelines.filter(t => t.id !== id);

    if (timelines.length < initialLength) {
      await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
      return true;
    }
    return false;
  }

  /**
   * Add an entry to a timeline.
   * @param {string} timelineId - Timeline ID.
   * @param {Object} entryData - Entry data (name, description).
   * @returns {Promise<Object|null>} The created entry or null.
   */
  static async addEntry(timelineId, entryData) {
    const timelines = this.getTimelines();
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return null;

    const newEntry = {
      id: foundry.utils.randomID(),
      name: entryData.name || "New Entry",
      period: entryData.period || "",
      description: entryData.description || "",
      hidden: entryData.hidden ?? false,
      color: entryData.color || "",
      img: entryData.img || "",
      tagIds: entryData.tagIds || [],
      sort: timeline.entries.length
    };

    timeline.entries.push(newEntry);
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return newEntry;
  }

  /**
   * Insert an entry after a specific entry in a timeline.
   * @param {string} timelineId - Timeline ID.
   * @param {string} targetEntryId - The ID of the entry to insert after.
   * @param {Object} entryData - Entry data.
   * @returns {Promise<Object|null>} The created entry or null.
   */
  static async insertEntry(timelineId, targetEntryId, entryData) {
    const timelines = this.getTimelines();
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return null;

    const targetIndex = timeline.entries.findIndex(e => e.id === targetEntryId);
    
    const newEntry = {
      id: foundry.utils.randomID(),
      name: entryData.name || "New Entry",
      period: entryData.period || "",
      description: entryData.description || "",
      hidden: entryData.hidden ?? false,
      color: entryData.color || "",
      img: entryData.img || "",
      tagIds: entryData.tagIds || [],
      sort: 0 // Will be updated
    };

    // Insert at index + 1 (if target not found, it appends to end because splice(-1 + 1) is 0)
    // But let's be safe: if targetIndex is -1, we should probably just push.
    if (targetIndex !== -1) {
      timeline.entries.splice(targetIndex + 1, 0, newEntry);
    } else {
      timeline.entries.push(newEntry);
    }

    // Re-sort all entries to ensure consistency
    timeline.entries.forEach((e, i) => e.sort = i);

    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return newEntry;
  }

  /**
   * Update an entry in a timeline.
   * @param {string} timelineId - Timeline ID.
   * @param {string} entryId - Entry ID.
   * @param {Object} data - Data to update.
   * @returns {Promise<Object|null>} Updated entry or null.
   */
  static async updateEntry(timelineId, entryId, data) {
    const timelines = this.getTimelines();
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return null;

    const entry = timeline.entries.find(e => e.id === entryId);
    if (!entry) return null;

    Object.assign(entry, data);
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return entry;
  }

  /**
   * Delete an entry from a timeline.
   * @param {string} timelineId - Timeline ID.
   * @param {string} entryId - Entry ID.
   * @returns {Promise<boolean>} True if deleted.
   */
  static async deleteEntry(timelineId, entryId) {
    const timelines = this.getTimelines();
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return false;

    const initialLength = timeline.entries.length;
    timeline.entries = timeline.entries.filter(e => e.id !== entryId);

    if (timeline.entries.length < initialLength) {
      // Re-sort entries
      timeline.entries.forEach((e, i) => e.sort = i);
      await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
      return true;
    }
    return false;
  }

  /**
   * Reorder entries based on drag & drop.
   * @param {string} timelineId - Timeline ID.
   * @param {Array<string>} orderedIds - Array of entry IDs in new order.
   * @returns {Promise<boolean>} True if reordered.
   */
  static async updateEntryOrder(timelineId, orderedIds) {
    const timelines = this.getTimelines();
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return false;

    // Create a map of entries by ID
    const entryMap = new Map(timeline.entries.map(e => [e.id, e]));

    // Rebuild entries array in new order
    const newEntries = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const entry = entryMap.get(orderedIds[i]);
      if (entry) {
        entry.sort = i;
        newEntries.push(entry);
      }
    }

    timeline.entries = newEntries;
    await game.settings.set(MODULE_ID, SETTINGS.DATA, timelines);
    return true;
  }
}
