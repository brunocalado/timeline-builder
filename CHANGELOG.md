# 0.1.2

- https://github.com/brunocalado/timeline-builder/issues/7
- [Added] Import and export timelines as JSON files. A new **Import / Export** menu in Foundry's Configure Settings (under this module's section) lets you pick which timelines to export, and detects id conflicts on import so you can skip, replace, or import each one as a copy.

# 0.1.1

- [Added] Export a timeline to PDF from the Timeline Manager toolbar (new **PDF** button). Generates a clean, paginated document (timeframe, title, description, tag pills and embedded images) as a real downloadable `.pdf` file — no external dependencies.
- [Changed] Increased the Timeline Manager default window width (1000 → 1080px) so the toolbar buttons no longer get clipped.

# 0.1.0

- v14 only
- [Fixed] CSS: neutralize Foundry VTT's global `.active` button outline and box-shadow — module scope only

# 0.0.6

- CSS split
- CSS vars
- [Fixed] CSS: duplicate `@keyframes timeline-builder-glitch` — card glitch animation renamed to `timeline-builder-card-glitch`, fixing the broken line-glitch effect
- [Fixed] CSS: `.card-box` conflicting `max-height` values merged into a single `240px`
- [Fixed] CSS: `.track-line` had `height` declared twice — removed the hardcoded `2px` duplicate
- [Changed] CSS: merged 9 duplicate selector pairs from "MOVED FROM" inline sections into their canonical definitions
- https://github.com/brunocalado/timeline-builder/issues/4

# 0.0.5

- Filepicker work for https://forge-vtt.com/, should solve https://github.com/brunocalado/timeline-builder/issues/1

# 0.0.4
- small CSS fix for document button
- Search for Manager
- Preserve entry list scroll position in Manager when adding, deleting, or reordering entries
- Save Manager scroll position per user and timeline, automatically restored on next view
- Manager remembers last selected timeline and reopens it (if still exists)
- Save viewer scroll position per user and timeline, automatically restored on next view
- Fix Deprecated warning
- Small CSS fix for renderJournalDirectory