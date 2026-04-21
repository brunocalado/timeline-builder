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