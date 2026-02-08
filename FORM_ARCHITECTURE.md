# Timeline Builder – Form Architecture

This document explains the inheritance hierarchy used by every application
window in the Timeline Builder module.

---

## Class Diagram

```
Foundry VTT
└── ApplicationV2                      (Foundry base – handles window chrome, lifecycle)
    │
    └── BaseTimelineForm               (scripts/forms/BaseTimelineForm.js)
        │   Common to ALL Timeline Builder windows:
        │   • CSS class `.timeline-builder`
        │   • Ghost-scrollbar style injection
        │   • Notification helpers (_notifyInfo / _notifyWarning / _notifyError)
        │   • Dialog helpers (_confirmDialog / _promptDialog)
        │   • TimelineStore shortcuts (_store, _getTimelines, _getTags, _getColors)
        │   • Glass-morphism helper (_getGlassStyle)
        │
        ├── BaseHandlebarsForm         (scripts/forms/BaseHandlebarsForm.js)
        │   │   For windows that use external .hbs templates (PARTS).
        │   │   Adds HandlebarsApplicationMixin and a shared _prepareContext
        │   │   with { isGM, userAvatar }.
        │   │
        │   ├── TimelineManager        (scripts/manager.js)
        │   │       Main GM editor – drag & drop, live editing, tabs, settings dialogs.
        │   │
        │   ├── TimelineViewer         (scripts/viewer.js)
        │   │       Horizontal viewer – tag filters, text search, lightbox, auto-refresh.
        │   │
        │   └── TimelineWelcome        (scripts/welcome.js)
        │           One-time welcome screen for first-time setup.
        │
        └── BaseCRUDForm              (scripts/forms/BaseCRUDForm.js)
            │   For simple dialog-style windows that build HTML inline
            │   via _renderHTML() instead of .hbs templates.
            │   Provides reusable UI blocks:
            │   • _wrapContent(html)
            │   • _buildCreateRow({ inputId, buttonId, placeholder, colorId })
            │   • _buildInfoBanner(message)
            │   • _buildEmptyState(message)
            │   • _buildChipList(className, inner)
            │   • _buildChip({ id, label, color, dataAttr, deleteAction })
            │   • Standard _replaceHTML (sets innerHTML)
            │
            ├── TagManager             (scripts/manager.js)
            │       Create / edit / delete global tags.
            │
            ├── ColorManager           (scripts/manager.js)
            │       Create / edit / delete global color palette.
            │
            └── PermissionManager      (scripts/manager.js)
                    Per-user visibility overrides for a timeline.
```

---

## How Inheritance Works

JavaScript classes inherit using `extends`. When a child defines a method,
it **overrides** the parent's version. Calling `super.method()` runs the
parent's implementation first, so shared behaviour is preserved.

```js
// Example – TagManager._onRender chains into BaseTimelineForm._onRender
_onRender(context, options) {
  super._onRender(context, options);   // ← injects ghost-scrollbar styles
  // … TagManager-specific listeners …
}
```

### DEFAULT_OPTIONS merging

Foundry's ApplicationV2 deeply merges `DEFAULT_OPTIONS` from the class chain.
Each child only declares the options it wants to **add or override**:

```js
// BaseTimelineForm sets the baseline
static DEFAULT_OPTIONS = {
  classes: ["timeline-builder"],
  window: { icon: "fa-solid fa-clock-rotate-left", resizable: true }
};

// TagManager only overrides what it needs
static DEFAULT_OPTIONS = {
  id: "tag-manager",
  window: { title: "Manage Global Tags", icon: "fa-solid fa-tags" },
  position: { width: 400, height: "auto" }
};
// Result: merges both – gets "timeline-builder" class + tag-specific options.
```

---

## Quick Reference – Which base to extend?

| I need…                        | Extend this class      |
|--------------------------------|------------------------|
| A window with .hbs template(s) | `BaseHandlebarsForm`   |
| A simple dialog with inline HTML | `BaseCRUDForm`       |
| Something else entirely        | `BaseTimelineForm`     |

---

## Adding a New Form

1. Decide if it uses templates → `BaseHandlebarsForm`, or inline HTML → `BaseCRUDForm`.
2. Create your class extending the chosen base.
3. Override `DEFAULT_OPTIONS` with only the properties you need to change.
4. Implement the required method:
   - **Handlebars forms**: `static PARTS`, `_prepareContext(options)`
   - **CRUD forms**: `_renderHTML(context, options)`, `_onRender(context, options)`
5. Call `super._onRender(context, options)` in your `_onRender` to keep shared behaviour.

---

## Files

| File | Contains |
|------|----------|
| `scripts/forms/BaseTimelineForm.js` | Root base class |
| `scripts/forms/BaseHandlebarsForm.js` | Handlebars mixin base |
| `scripts/forms/BaseCRUDForm.js` | Inline-HTML CRUD base |
| `scripts/manager.js` | TimelineManager, TagManager, ColorManager, PermissionManager |
| `scripts/viewer.js` | TimelineViewer |
| `scripts/welcome.js` | TimelineWelcome |
