/**
 * Timeline Builder - Entry Point
 * A module for creating and managing campaign timelines in Foundry VTT.
 */

import { MODULE_ID, SETTINGS, TEMPLATES, DEFAULT_COLORS } from "./config.js";
import { TimelineManager } from "./manager.js";
import { TimelineViewer } from "./viewer.js";
import { TimelineWelcome } from "./welcome.js";

// Singleton instances
let managerInstance = null;
let viewerInstance = null;

/**
 * Global API for Timeline module.
 */
const TimelineAPI = {
  /**
   * Open the Timeline Manager (GM only).
   * @returns {TimelineManager} The manager application instance.
   */
  Manage() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can manage timelines.");
      return null;
    }
    if (!managerInstance) {
      managerInstance = new TimelineManager();
    }
    managerInstance.render(true);
    return managerInstance;
  },

  /**
   * Open the Timeline Viewer.
   * @returns {TimelineViewer} The viewer application instance.
   */
  Open(timelineId) {
    if (!viewerInstance) {
      viewerInstance = new TimelineViewer();
    }
    if (timelineId) {
      viewerInstance.selectTimeline(timelineId);
    }
    viewerInstance.render(true);
    return viewerInstance;
  }
};

// Initialize module
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Timeline Builder module`);

  // Register settings
  game.settings.register(MODULE_ID, SETTINGS.DATA, {
    name: "Timeline Data",
    hint: "Stores all timeline data for this world.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Register tags setting
  game.settings.register(MODULE_ID, SETTINGS.TAGS, {
    name: "Timeline Tags",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Register welcome screen setting
  game.settings.register(MODULE_ID, "welcomeScreenShown", {
    name: "Welcome Screen Shown",
    hint: "Uncheck to show the welcome screen again.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  // Register colors setting
  game.settings.register(MODULE_ID, SETTINGS.COLORS, {
    name: "Timeline Colors",
    scope: "world",
    config: false,
    type: Array,
    default: DEFAULT_COLORS
  });

  // Register broadcast setting (used to show timeline to all connected clients)
  game.settings.register(MODULE_ID, SETTINGS.BROADCAST, {
    name: "Broadcast Timeline",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Register viewer scroll positions (per-user, per-timeline)
  game.settings.register(MODULE_ID, "viewerScrollPositions", {
    name: "Viewer Scroll Positions",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  // Preload templates
  foundry.applications.handlebars.loadTemplates([
    TEMPLATES.MANAGER,
    TEMPLATES.VIEWER,
    TEMPLATES.ENTRY,
    TEMPLATES.WELCOME
  ]);

  // Register Handlebars partials
  Handlebars.registerPartial("timeline-entry", `{{> ${TEMPLATES.ENTRY}}}`);

  // Register helper for custom icon select
  Handlebars.registerHelper("renderIconSelect", function(iconOptions, selected) {
    let html = `<div class="tl-custom-select">`;
    html += `<input type="hidden" class="entry-icon" value="${selected || ""}">`;
    
    let displayLabel = "None";
    if (selected) {
        displayLabel = selected;
        if (iconOptions && !Array.isArray(iconOptions) && iconOptions[selected]) {
            displayLabel = iconOptions[selected];
        }
    }

    html += `<div class="tl-select-trigger">`;
    if (selected) {
        html += `<i class="${selected}"></i> <span class="label">${displayLabel}</span>`;
    } else {
        html += `<span class="label">None</span>`;
    }
    html += `<i class="fa-solid fa-chevron-down chevron"></i></div>`;

    html += `<div class="tl-select-options">`;
    html += `<div class="tl-select-option" data-value="">None</div>`;

    const processOption = (key, label) => {
        const isSelected = key === selected ? "selected" : "";
        return `<div class="tl-select-option ${isSelected}" data-value="${key}"><i class="${key}"></i> ${label}</div>`;
    };

    if (Array.isArray(iconOptions)) {
        iconOptions.forEach(opt => html += processOption(opt, opt));
    } else if (typeof iconOptions === 'object') {
        for (const [key, label] of Object.entries(iconOptions)) {
            html += processOption(key, label);
        }
    }

    html += `</div></div>`;
    return new Handlebars.SafeString(html);
  });
});

// Setup API when ready
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Timeline Builder is ready`);

  // Expose global API
  globalThis.Timeline = TimelineAPI;

  // Also expose via module API
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = TimelineAPI;
  }

  // Listen for broadcast setting changes to show timeline on all clients (except the GM who triggered it)
  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${SETTINGS.BROADCAST}`) {
      if (game.user.isGM) return;
      const data = game.settings.get(MODULE_ID, SETTINGS.BROADCAST);
      if (data?.timelineId) {
        TimelineAPI.Open(data.timelineId);
      }
    }
  });

  // Show Welcome Screen for GM if not seen yet
  if (game.user.isGM && !game.settings.get(MODULE_ID, "welcomeScreenShown")) {
    new TimelineWelcome().render(true);
  }

  // Global listener for Custom Select interactions
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tl-select-trigger")) {
        const trigger = e.target.closest(".tl-select-trigger");
        const wrapper = trigger.closest(".tl-custom-select");
        document.querySelectorAll(".tl-custom-select.active").forEach(el => {
            if (el !== wrapper) el.classList.remove("active");
        });
        wrapper.classList.toggle("active");
        e.stopPropagation();
        return;
    }

    if (e.target.closest(".tl-select-option")) {
        const option = e.target.closest(".tl-select-option");
        const wrapper = option.closest(".tl-custom-select");
        const input = wrapper.querySelector("input.entry-icon");
        const trigger = wrapper.querySelector(".tl-select-trigger");
        const value = option.dataset.value;
        
        let newContent = `<span class="label">None</span>`;
        if (value) {
             const text = option.textContent.trim();
             newContent = `<i class="${value}"></i> <span class="label">${text}</span>`;
        }
        newContent += `<i class="fa-solid fa-chevron-down chevron"></i>`;
        trigger.innerHTML = newContent;

        const previousValue = input.value;
        input.value = value;
        wrapper.classList.remove("active");
        
        if (previousValue !== value) {
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        e.stopPropagation();
        return;
    }

    document.querySelectorAll(".tl-custom-select.active").forEach(el => {
        el.classList.remove("active");
    });
  });
});

// Add control button to sidebar
Hooks.on("getSceneControlButtons", (controls) => {
  // Foundry v13+: controls and tools are objects keyed by name
  const notesControl = controls.notes;
  if (notesControl) {
    notesControl.tools.timeline = {
      name: "timeline",
      title: "Timeline",
      icon: "fa-solid fa-clock-rotate-left",
      button: true,
      onClick: () => {
        if (game.user.isGM) {
          TimelineAPI.Manage();
        } else {
          TimelineAPI.Open();
        }
      }
    };
  }
});

Hooks.on("renderJournalDirectory", (app, html) => {
    const element = (html instanceof HTMLElement) ? html : html[0];
    const actionButtons = element.querySelector(".header-actions");
    
    if (actionButtons) {
        // Create Open Timeline button (used in both cases)
        const btnOpen = document.createElement("button");
        btnOpen.type = "button";
        btnOpen.innerHTML = `<i class="fa-solid fa-film"></i> Open Timeline`;
        btnOpen.onclick = (e) => { 
            e.preventDefault(); 
            TimelineAPI.Open();
        };

        if (game.user.isGM) {
            // --- GM VIEW: TWO BUTTONS SIDE-BY-SIDE ---
            
            // Flex Container
            const div = document.createElement("div");
            div.classList.add("flexrow");
            div.style.marginTop = "6px";
            div.style.gap = "5px";
            div.style.width = "100%";

            // Manage Button
            const btnManage = document.createElement("button");
            btnManage.type = "button";
            btnManage.innerHTML = `<i class="fa-solid fa-gear"></i> Timeline Manager`;
            btnManage.style.flex = "1"; // Occupies 50%
            btnManage.onclick = (e) => { 
                e.preventDefault(); 
                TimelineAPI.Manage();
            };

            // Adjust btnOpen style to fit alongside
            btnOpen.style.flex = "1"; // Occupies 50%

            div.appendChild(btnManage);
            div.appendChild(btnOpen);
            actionButtons.appendChild(div);

        } else {
            // --- PLAYER VIEW: SINGLE BUTTON ---
            
            // Standard directory button style (full width)
            btnOpen.style.flex = "0 0 100%";
            btnOpen.style.maxWidth = "100%";
            btnOpen.style.marginTop = "6px";

            actionButtons.appendChild(btnOpen);
        }
    }
});