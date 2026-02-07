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

  // Preload templates
  foundry.applications.handlebars.loadTemplates([
    TEMPLATES.MANAGER,
    TEMPLATES.VIEWER,
    TEMPLATES.ENTRY,
    TEMPLATES.WELCOME
  ]);

  // Register Handlebars partials
  Handlebars.registerPartial("timeline-entry", `{{> ${TEMPLATES.ENTRY}}}`);
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

  console.log(`${MODULE_ID} | API available at: Timeline.Manage() and Timeline.Open()`);

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