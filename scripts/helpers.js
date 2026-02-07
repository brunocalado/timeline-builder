/**
 * Timeline Builder - Shared Helpers
 */

/**
 * Generate Glassmorphism styles from a base hex color.
 * Background: 15% opacity (Base Color)
 * Border: Base Color mixed with 50% White
 * Text: Base Color mixed with 70% White
 */
export function getGlassStyle(hex) {
  if (!hex) return "";
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `background: ${hex}; color: #fff;`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  const mix = (c, w) => Math.round(c * (1 - w) + 255 * w);
  const tr = mix(r, 0.7);
  const tg = mix(g, 0.7);
  const tb = mix(b, 0.7);
  const br = mix(r, 0.5);
  const bg = mix(g, 0.5);
  const bb = mix(b, 0.5);

  return `background: rgba(${r}, ${g}, ${b}, 0.15); border: 1px solid rgb(${br}, ${bg}, ${bb}); color: rgb(${tr}, ${tg}, ${tb});`;
}

/**
 * Resolve display properties for a timeline entry (color, effect, mystery flag).
 * Mutates the entry object in-place.
 */
export function resolveEntryDisplayProps(entry, timeline) {
  entry.displayColor = entry.color || timeline.defaultColor || "var(--tl-text-muted)";
  const eff = entry.effect || "default";
  entry.displayEffect = eff === "default" ? (timeline.defaultEffect || "none") : eff;

  if (["glow", "glow-strong", "glitch"].includes(entry.displayEffect)) {
    entry.displayEffectColor = entry.effectColor || timeline.defaultColor || "#2ec4a0";
  } else {
    entry.displayEffectColor = "";
  }

  const m = entry.mystery;
  entry.hasMystery = !!(m && (m.img || m.text || m.timeframe));
}

/**
 * Resolve page names for entries with linked journal pages.
 * Mutates entries in-place, setting pageName on each entry that has a pageUuid.
 */
export async function resolvePageNames(entries) {
  await Promise.all(entries.map(async (entry) => {
    if (entry.pageUuid) {
      try {
        const doc = await fromUuid(entry.pageUuid);
        entry.pageName = doc?.name || "Unknown Page";
      } catch {
        entry.pageName = "Unknown Page";
      }
    }
  }));
}
