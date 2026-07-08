/*!
 * ⏳ Timeline Builder
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Timeline Builder - PDF Export
 *
 * Self-contained, dependency-free PDF generator. It reconstructs a timeline as a
 * clean, paginated A4 document (vertical timeline rail, colored dots, timeframe,
 * title, description, tag pills and optional embedded images) and triggers a
 * real `.pdf` download.
 *
 * Why hand-rolled instead of a library: Foundry does not ship a PDF engine and the
 * module must stay dependency-free. The viewer relies on heavy CSS effects
 * (backdrop-filter glassmorphism, neon, etc.) that DOM rasterization cannot render
 * faithfully, so we emit a vector document with selectable text instead.
 */

// A4 portrait, in PDF points (1/72 inch).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

const RAIL_X = MARGIN + 6;          // Center of the vertical timeline rail.
const CONTENT_X = MARGIN + 30;      // Left edge of the entry content column.
const CONTENT_RIGHT = PAGE_W - MARGIN;
const CONTENT_W = CONTENT_RIGHT - CONTENT_X;

// Document palette (light theme, readable on a white page).
const COLOR_TITLE = [0.10, 0.10, 0.10];
const COLOR_NAME = [0.10, 0.10, 0.10];
const COLOR_DESC = [0.27, 0.27, 0.27];
const COLOR_MUTED = [0.55, 0.58, 0.62];
const COLOR_RAIL = [0.85, 0.85, 0.85];
const COLOR_ACCENT = [0.18, 0.77, 0.63]; // Module primary (#2ec4a0).

// Adobe Helvetica advance widths (per 1000 em), character codes 32-126.
// Accented Latin glyphs share their base letter's width in Helvetica, so a flat
// fallback for codes outside this range keeps wrapping accurate enough.
const W_HELV = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333,
  41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 48: 556, 49: 556,
  50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556, 58: 278,
  59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015, 65: 667, 66: 667, 67: 722,
  68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500, 75: 667, 76: 556,
  77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722,
  86: 667, 87: 944, 88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469,
  95: 556, 96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556,
  112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
  120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584
};

// Adobe Helvetica-Bold advance widths (per 1000 em), character codes 32-126.
const W_HELV_BOLD = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238, 40: 333,
  41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 48: 556, 49: 556,
  50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556, 58: 333,
  59: 333, 60: 584, 61: 584, 62: 584, 63: 611, 64: 975, 65: 722, 66: 722, 67: 722,
  68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 556, 75: 722, 76: 611,
  77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722,
  86: 667, 87: 944, 88: 667, 89: 667, 90: 611, 91: 333, 92: 278, 93: 333, 94: 584,
  95: 556, 96: 333, 97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611,
  104: 611, 105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611, 111: 611,
  112: 611, 113: 611, 114: 389, 115: 556, 116: 333, 117: 611, 118: 556, 119: 778,
  120: 556, 121: 556, 122: 500, 123: 389, 124: 280, 125: 389, 126: 584
};

// Unicode -> CP1252 (WinAnsi) overrides for punctuation frequently produced by
// rich-text editors. Codepoints <= 0xFF pass through unchanged.
const CP1252_OVERRIDES = {
  0x2018: 0x91, 0x2019: 0x92, 0x201A: 0x82, 0x201C: 0x93, 0x201D: 0x94,
  0x201E: 0x84, 0x2020: 0x86, 0x2021: 0x87, 0x2022: 0x95, 0x2026: 0x85,
  0x2013: 0x96, 0x2014: 0x97, 0x2039: 0x8B, 0x203A: 0x9B, 0x20AC: 0x80,
  0x2122: 0x99, 0x0152: 0x8C, 0x0153: 0x9C, 0x0160: 0x8A, 0x0161: 0x9A,
  0x0178: 0x9F, 0x017D: 0x8E, 0x017E: 0x9E, 0x0192: 0x83
};

/**
 * Map a Unicode codepoint to its CP1252/WinAnsi byte (0-255).
 * @param {number} cp - Unicode codepoint.
 * @returns {number} A byte value; 0x3F ('?') for unrepresentable characters.
 */
function toCP1252(cp) {
  if (cp in CP1252_OVERRIDES) return CP1252_OVERRIDES[cp];
  if (cp >= 0 && cp <= 0xFF) return cp;
  return 0x3F;
}

/**
 * Measure the rendered width of a string for the given font/size.
 * @param {string} str - Text to measure.
 * @param {number} size - Font size in points.
 * @param {boolean} bold - Whether the bold face is used.
 * @returns {number} Width in points.
 */
function textWidth(str, size, bold) {
  const table = bold ? W_HELV_BOLD : W_HELV;
  let total = 0;
  for (const ch of str) {
    const b = toCP1252(ch.codePointAt(0));
    total += table[b] ?? 556;
  }
  return (total / 1000) * size;
}

/**
 * Encode a string as a PDF literal string using WinAnsi bytes, escaping the
 * characters that are significant inside `( ... )`.
 * @param {string} str - Text to encode.
 * @returns {string} A parenthesized, escaped PDF string token.
 */
function pdfString(str) {
  let out = "(";
  for (const ch of str) {
    const b = toCP1252(ch.codePointAt(0));
    if (b === 0x28) out += "\\(";
    else if (b === 0x29) out += "\\)";
    else if (b === 0x5C) out += "\\\\";
    else if (b < 32 || b > 126) out += "\\" + b.toString(8).padStart(3, "0");
    else out += String.fromCharCode(b);
  }
  return out + ")";
}

/**
 * Convert a JS string into Latin1 bytes (one byte per code unit).
 * All PDF syntax we emit is ASCII, so this preserves the binary comment header
 * and octal escapes exactly.
 * @param {string} str - Source string.
 * @returns {Uint8Array}
 */
function latin1Bytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xFF;
  return bytes;
}

/**
 * Parse a CSS hex color (`#rgb` or `#rrggbb`) into normalized PDF rgb components.
 * @param {string} hex - Color string.
 * @param {number[]} fallback - Components to use when parsing fails.
 * @returns {number[]} `[r, g, b]` in the 0..1 range.
 */
function hexToRgb(hex, fallback) {
  if (typeof hex !== "string") return fallback;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return fallback;
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

/**
 * Relative luminance of an rgb triplet, used to pick readable pill text color.
 * @param {number[]} rgb - `[r, g, b]` in 0..1.
 * @returns {number} Luminance in 0..1.
 */
function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Strip HTML tags and decode a handful of common entities so rich-text
 * descriptions collapse to clean plain text.
 * @param {string} html - Possibly HTML-bearing string.
 * @returns {string} Plain text.
 */
function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Greedy word-wrap that also hard-breaks single words wider than `maxW`.
 * @param {string} text - Text to wrap (single logical line).
 * @param {number} size - Font size in points.
 * @param {boolean} bold - Whether the bold face is used.
 * @param {number} maxW - Maximum line width in points.
 * @returns {string[]} Wrapped lines.
 */
function wrapLine(text, size, bold, maxW) {
  const lines = [];
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";

  const pushBrokenWord = (word) => {
    let chunk = "";
    for (const ch of word) {
      if (textWidth(chunk + ch, size, bold) > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (textWidth(test, size, bold) <= maxW) {
      line = test;
    } else if (!line && textWidth(word, size, bold) > maxW) {
      line = pushBrokenWord(word);
    } else {
      if (line) lines.push(line);
      if (textWidth(word, size, bold) > maxW) {
        line = pushBrokenWord(word);
      } else {
        line = word;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Wrap multi-paragraph text (split on newlines, then word-wrap each paragraph).
 * @param {string} text - Text possibly containing newlines.
 * @param {number} size - Font size in points.
 * @param {boolean} bold - Whether the bold face is used.
 * @param {number} maxW - Maximum line width in points.
 * @returns {string[]} Wrapped lines.
 */
function wrapText(text, size, bold, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    out.push(...wrapLine(para.trim(), size, bold, maxW));
  }
  return out;
}

/**
 * Load an image URL and re-encode it as JPEG bytes suitable for PDF embedding.
 * Same-origin Foundry assets load cleanly; cross-origin/tainted sources or load
 * errors resolve to `null` so export can continue without the image.
 * @param {string} src - Image URL or path.
 * @returns {Promise<{bytes: Uint8Array, width: number, height: number}|null>}
 */
function loadImageAsJpeg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        // JPEG has no alpha; paint white so transparent PNGs don't turn black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve({ bytes, width: img.naturalWidth, height: img.naturalHeight });
      } catch (err) {
        // Canvas tainted by a cross-origin source, or encoding failed.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Accumulates content-stream operators for one page and tracks the timeline rail
 * extent so it can be drawn once the page's height is known.
 */
class Page {
  constructor(railTop) {
    /** @type {string[]} Content operators, joined at build time. */
    this.ops = [];
    /** @type {number} Y (from top) where this page's rail starts. */
    this.railTop = railTop;
    /** @type {number} Y (from top) where this page's rail currently ends. */
    this.railBottom = railTop;
  }
}

/**
 * Lays out a timeline model into one or more {@link Page}s and emits PDF operators.
 * Coordinates are authored top-down (`y` = distance from page top) and converted
 * to PDF's bottom-left origin on emit.
 */
class TimelineLayout {
  /**
   * @param {{name: string, entries: object[]}} model - Timeline export model.
   * @param {Map<string, {name: string, width: number, height: number}>} imageMap
   *   Map from image src to its embedded XObject name and pixel dimensions.
   */
  constructor(model, imageMap) {
    this.model = model;
    this.imageMap = imageMap;
    this.pages = [];
    this.page = null;
    this.y = 0;
    this.#newPage(MARGIN);
    this.#drawHeader();
  }

  /**
   * Start a fresh page and reset the vertical cursor.
   * @param {number} railTop - Y (from top) where the rail begins on the new page.
   */
  #newPage(railTop) {
    this.page = new Page(railTop);
    this.pages.push(this.page);
    this.y = railTop;
  }

  /** Convert a top-down Y baseline into PDF (bottom-left origin) space. */
  #pdfY(yTop) {
    return PAGE_H - yTop;
  }

  /**
   * Emit a run of text at the current column.
   * @param {string} str - Text (already wrapped to a single line).
   * @param {number} x - Left X in points.
   * @param {number} size - Font size in points.
   * @param {object} [opts] - `bold`, `color` ([r,g,b]).
   */
  #text(str, x, size, opts = {}) {
    const color = opts.color ?? COLOR_NAME;
    const font = opts.bold ? "F2" : "F1";
    // Baseline sits `size` below the current top cursor.
    const baseline = this.#pdfY(this.y + size);
    this.page.ops.push(
      `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`,
      "BT",
      `/${font} ${size} Tf`,
      `1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm`,
      `${pdfString(str)} Tj`,
      "ET"
    );
  }

  /**
   * Draw a filled rectangle (top-down coordinates).
   * @param {number} x - Left X.
   * @param {number} yTop - Top Y (from page top).
   * @param {number} w - Width.
   * @param {number} h - Height.
   * @param {number[]} color - Fill `[r,g,b]`.
   */
  #rect(x, yTop, w, h, color) {
    const yBottom = this.#pdfY(yTop + h);
    this.page.ops.push(
      `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`,
      `${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`
    );
  }

  /**
   * Draw a fully-rounded (pill) rectangle via bezier corners.
   * @param {number} x - Left X.
   * @param {number} yTop - Top Y (from page top).
   * @param {number} w - Width.
   * @param {number} h - Height.
   * @param {number[]} color - Fill `[r,g,b]`.
   */
  #pill(x, yTop, w, h, color) {
    const r = h / 2;
    const k = 0.5523 * r; // Bezier constant for a quarter circle.
    const yb = this.#pdfY(yTop + h); // bottom
    const yt = this.#pdfY(yTop);     // top
    const xl = x;
    const xr = x + w;
    const p = (n) => n.toFixed(2);
    this.page.ops.push(
      `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`,
      `${p(xl)} ${p(yb + r)} m`,
      `${p(xl)} ${p(yb + r - k)} ${p(xl + r - k)} ${p(yb)} ${p(xl + r)} ${p(yb)} c`,
      `${p(xr - r)} ${p(yb)} l`,
      `${p(xr - r + k)} ${p(yb)} ${p(xr)} ${p(yb + r - k)} ${p(xr)} ${p(yb + r)} c`,
      `${p(xr)} ${p(yt - r + k)} ${p(xr - r + k)} ${p(yt)} ${p(xr - r)} ${p(yt)} c`,
      `${p(xl + r)} ${p(yt)} l`,
      `${p(xl + r - k)} ${p(yt)} ${p(xl)} ${p(yt - r + k)} ${p(xl)} ${p(yt - r)} c`,
      "f"
    );
  }

  /**
   * Draw a filled circle centered at (cx, cyTop).
   * @param {number} cx - Center X.
   * @param {number} cyTop - Center Y (from page top).
   * @param {number} r - Radius.
   * @param {number[]} color - Fill `[r,g,b]`.
   */
  #circle(cx, cyTop, r, color) {
    const cy = this.#pdfY(cyTop);
    const k = 0.5523 * r;
    const p = (n) => n.toFixed(2);
    this.page.ops.push(
      `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`,
      `${p(cx + r)} ${p(cy)} m`,
      `${p(cx + r)} ${p(cy + k)} ${p(cx + k)} ${p(cy + r)} ${p(cx)} ${p(cy + r)} c`,
      `${p(cx - k)} ${p(cy + r)} ${p(cx - r)} ${p(cy + k)} ${p(cx - r)} ${p(cy)} c`,
      `${p(cx - r)} ${p(cy - k)} ${p(cx - k)} ${p(cy - r)} ${p(cx)} ${p(cy - r)} c`,
      `${p(cx + k)} ${p(cy - r)} ${p(cx + r)} ${p(cy - k)} ${p(cx + r)} ${p(cy)} c`,
      "f"
    );
  }

  /**
   * Place an embedded image at the current column.
   * @param {string} name - XObject resource name (e.g. "Im0").
   * @param {number} x - Left X.
   * @param {number} yTop - Top Y (from page top).
   * @param {number} w - Display width.
   * @param {number} h - Display height.
   */
  #image(name, x, yTop, w, h) {
    const yBottom = this.#pdfY(yTop + h);
    this.page.ops.push(
      "q",
      `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${yBottom.toFixed(2)} cm`,
      `/${name} Do`,
      "Q"
    );
  }

  /** Draw the document header (title + subtitle) on the first page. */
  #drawHeader() {
    this.#text(this.model.name || "Timeline", MARGIN, 22, { bold: true, color: COLOR_TITLE });
    this.y += 30;

    const count = this.model.entries.length;
    const subtitle = `${count} ${count === 1 ? "event" : "events"} · exported ${new Date().toLocaleDateString()}`;
    this.#text(subtitle, MARGIN, 9, { color: COLOR_MUTED });
    this.y += 14;

    // Accent underline spanning the content width.
    this.#rect(MARGIN, this.y, CONTENT_RIGHT - MARGIN, 1.5, COLOR_ACCENT);
    this.y += 18;

    this.page.railTop = this.y;
    this.page.railBottom = this.y;
  }

  /**
   * Ensure at least `needed` points remain before the bottom margin, breaking to
   * a new page (rail reset to the top margin) when they do not.
   * @param {number} needed - Vertical space required in points.
   */
  #ensureSpace(needed) {
    if (this.y + needed <= PAGE_H - MARGIN) return;
    this.page.railBottom = this.y;
    this.#newPage(MARGIN);
  }

  /**
   * Lay out every entry. Call once after construction.
   */
  build() {
    if (this.model.entries.length === 0) {
      this.#text("This timeline has no visible events.", CONTENT_X, 11, { color: COLOR_MUTED });
      this.y += 16;
      this.page.railBottom = this.page.railTop;
      return;
    }
    for (const entry of this.model.entries) this.#drawEntry(entry);
    this.page.railBottom = this.y;
  }

  /**
   * Lay out a single timeline entry (dot, timeframe, name, description, tags, image).
   * @param {object} entry - Prepared entry snapshot.
   */
  #drawEntry(entry) {
    const dotColor = hexToRgb(entry.color, COLOR_ACCENT);

    // Reserve room for at least the dot + timeframe + name so an entry never
    // starts orphaned at the very bottom of a page.
    this.#ensureSpace(48);

    const entryTop = this.y;
    this.#circle(RAIL_X, entryTop + 5, 3.6, dotColor);
    this.page.railBottom = this.y;

    // Timeframe
    if (entry.period) {
      this.#text(entry.period, CONTENT_X, 9, { bold: true, color: dotColor });
      this.y += 12;
    }

    // Name
    const nameLines = wrapText(entry.name || "Untitled", 13, true, CONTENT_W);
    for (const line of nameLines) {
      this.#ensureSpace(16);
      this.#text(line, CONTENT_X, 13, { bold: true, color: COLOR_NAME });
      this.y += 16;
    }

    // Description
    const desc = stripHtml(entry.description);
    if (desc) {
      this.y += 2;
      for (const line of wrapText(desc, 10, false, CONTENT_W)) {
        this.#ensureSpace(13);
        if (line) this.#text(line, CONTENT_X, 10, { color: COLOR_DESC });
        this.y += 13;
      }
    }

    // Tags (pills)
    if (Array.isArray(entry.tags) && entry.tags.length) {
      this.#drawTags(entry.tags);
    }

    // Image
    const meta = entry.img ? this.imageMap.get(entry.img) : null;
    if (meta) {
      this.#drawImage(meta);
    }

    this.y += 16; // Gap between entries.
    this.page.railBottom = this.y;
  }

  /**
   * Lay out a row (or rows) of tag pills, wrapping within the content width.
   * @param {{label: string, color: string}[]} tags - Tag descriptors.
   */
  #drawTags(tags) {
    const size = 8.5;
    const padX = 7;
    const h = 15;
    this.y += 6;
    this.#ensureSpace(h + 4);

    let x = CONTENT_X;
    let rowTop = this.y;

    for (const tag of tags) {
      const label = tag.label || "";
      const w = textWidth(label, size, false) + padX * 2;

      if (x + w > CONTENT_RIGHT && x > CONTENT_X) {
        this.y = rowTop + h + 4;
        this.#ensureSpace(h + 4);
        rowTop = this.y;
        x = CONTENT_X;
      }

      const fill = hexToRgb(tag.color, COLOR_MUTED);
      const textColor = luminance(fill) > 0.6 ? [0.12, 0.12, 0.12] : [1, 1, 1];

      // Pill background then centered label.
      const savedY = this.y;
      this.y = rowTop;
      this.#pill(x, rowTop, w, h, fill);
      // Vertically center the text within the pill.
      this.y = rowTop + (h - size) / 2 - 0.5;
      this.#text(label, x + padX, size, { color: textColor });
      this.y = savedY;

      x += w + 5;
    }

    this.y = rowTop + h + 4;
  }

  /**
   * Place an entry image scaled to fit the layout box, breaking pages if needed.
   * @param {{name: string, width: number, height: number}} meta - Embedded image.
   */
  #drawImage(meta) {
    const maxW = Math.min(200, CONTENT_W);
    const maxH = 130;
    const scale = Math.min(maxW / meta.width, maxH / meta.height, 1);
    const w = meta.width * scale;
    const h = meta.height * scale;

    this.y += 6;
    this.#ensureSpace(h);
    this.#image(meta.name, CONTENT_X, this.y, w, h);
    this.y += h;
  }
}

/**
 * Assembles PDF objects, computes the cross-reference table, and returns the
 * complete file as bytes.
 */
class PdfWriter {
  constructor() {
    /** @type {(Array<string|Uint8Array>|null)[]} Object bodies, indexed by (num - 1). */
    this.objects = [];
  }

  /**
   * Reserve an object number without defining it yet (for forward references).
   * @returns {number} The 1-based object number.
   */
  reserve() {
    this.objects.push(null);
    return this.objects.length;
  }

  /**
   * Define a (possibly previously reserved) object's body.
   * @param {number} num - Object number.
   * @param {Array<string|Uint8Array>} chunks - Body chunks (between `obj`/`endobj`).
   */
  set(num, chunks) {
    this.objects[num - 1] = chunks;
  }

  /**
   * Define a new object in one call.
   * @param {Array<string|Uint8Array>} chunks - Body chunks.
   * @returns {number} The assigned object number.
   */
  add(chunks) {
    const num = this.reserve();
    this.set(num, chunks);
    return num;
  }

  /**
   * Serialize the whole document.
   * @param {number} catalogNum - Object number of the document catalog.
   * @returns {Uint8Array} The complete PDF file bytes.
   */
  build(catalogNum) {
    const parts = [];
    let length = 0;
    const push = (chunk) => {
      const bytes = typeof chunk === "string" ? latin1Bytes(chunk) : chunk;
      parts.push(bytes);
      length += bytes.length;
    };

    // Header (with a binary marker comment so tools treat the file as binary).
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    const offsets = new Array(this.objects.length + 1).fill(0);
    for (let i = 0; i < this.objects.length; i++) {
      const num = i + 1;
      offsets[num] = length;
      push(`${num} 0 obj\n`);
      for (const chunk of this.objects[i]) push(chunk);
      push("\nendobj\n");
    }

    // Cross-reference table.
    const xrefStart = length;
    const total = this.objects.length + 1;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let num = 1; num < total; num++) {
      xref += `${String(offsets[num]).padStart(10, "0")} 00000 n \n`;
    }
    push(xref);
    push(`trailer\n<< /Size ${total} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let pos = 0;
    for (const chunk of parts) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }
}

/**
 * Build the complete PDF byte array for a timeline model, embedding any loaded
 * images.
 * @param {{name: string, entries: object[]}} model - Timeline export model.
 * @param {Map<string, {bytes: Uint8Array, width: number, height: number}>} images
 *   Map from image src to decoded JPEG data.
 * @returns {Uint8Array} The complete PDF file bytes.
 */
function buildPdf(model, images) {
  const pdf = new PdfWriter();

  // Standard Type1 fonts (no embedding required), WinAnsi so accents render.
  const fontRegular = pdf.add([
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  ]);
  const fontBold = pdf.add([
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  ]);

  // Embed images and map src -> { name, width, height } for the layout pass.
  const imageMap = new Map();
  const xobjectEntries = [];
  let imgIndex = 0;
  for (const [src, data] of images) {
    if (!data) continue;
    const name = `Im${imgIndex++}`;
    const num = pdf.add([
      `<< /Type /XObject /Subtype /Image /Width ${data.width} /Height ${data.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.bytes.length} >>\nstream\n`,
      data.bytes,
      "\nendstream"
    ]);
    xobjectEntries.push(`/${name} ${num} 0 R`);
    imageMap.set(src, { name, width: data.width, height: data.height });
  }

  // Shared resources dictionary referenced by every page.
  const xobjectDict = xobjectEntries.length ? ` /XObject << ${xobjectEntries.join(" ")} >>` : "";
  const resources = pdf.add([
    `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${xobjectDict} >>`
  ]);

  // Lay out the timeline into pages.
  const layout = new TimelineLayout(model, imageMap);
  layout.build();

  // The pages tree must be referenced by each page's /Parent, so reserve it now.
  const pagesNum = pdf.reserve();
  const pageNums = [];
  const pageCount = layout.pages.length;

  layout.pages.forEach((page, idx) => {
    // Rail (vertical timeline line) drawn behind the page content.
    const railTop = page.railTop;
    const railBottom = Math.max(page.railBottom, railTop + 1);
    const railHeight = railBottom - railTop;
    const railBottomY = PAGE_H - railBottom;
    const preface = [
      `${COLOR_RAIL[0].toFixed(3)} ${COLOR_RAIL[1].toFixed(3)} ${COLOR_RAIL[2].toFixed(3)} rg`,
      `${(RAIL_X - 0.75).toFixed(2)} ${railBottomY.toFixed(2)} 1.5 ${railHeight.toFixed(2)} re f`
    ];

    // Page number footer.
    const footer = `Page ${idx + 1} of ${pageCount}`;
    const footerW = textWidth(footer, 8, false);
    const footerX = (PAGE_W - footerW) / 2;
    preface.push(
      `${COLOR_MUTED[0].toFixed(3)} ${COLOR_MUTED[1].toFixed(3)} ${COLOR_MUTED[2].toFixed(3)} rg`,
      "BT",
      `/F1 8 Tf`,
      `1 0 0 1 ${footerX.toFixed(2)} ${(MARGIN - 20).toFixed(2)} Tm`,
      `${pdfString(footer)} Tj`,
      "ET"
    );

    const content = preface.concat(page.ops).join("\n");
    const contentNum = pdf.add([
      `<< /Length ${latin1Bytes(content).length} >>\nstream\n`,
      content,
      "\nendstream"
    ]);

    pageNums.push(pdf.add([
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources ${resources} 0 R /Contents ${contentNum} 0 R >>`
    ]));
  });

  pdf.set(pagesNum, [
    `<< /Type /Pages /Kids [ ${pageNums.map(n => `${n} 0 R`).join(" ")} ] /Count ${pageCount} >>`
  ]);

  const catalog = pdf.add([`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`]);
  return pdf.build(catalog);
}

/**
 * Turn a timeline name into a safe download filename.
 * @param {string} name - Timeline name.
 * @returns {string} A `.pdf` filename.
 */
function safeFilename(name) {
  const base = (name || "timeline")
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "timeline";
  return `${base}.pdf`;
}

/**
 * Export a timeline model as a downloadable PDF file. Loads and embeds entry
 * images, generates the document, and triggers a browser download.
 *
 * @param {object} model - Export model.
 * @param {string} model.name - Timeline name (used for title and filename).
 * @param {Array<{period: string, name: string, description: string,
 *   tags: {label: string, color: string}[], img: string, color: string}>} model.entries
 *   Entries already filtered/masked for the current viewer.
 * @returns {Promise<void>}
 */
export async function exportTimelineToPdf(model) {
  // De-duplicate image sources so each is fetched/embedded once.
  const sources = [...new Set(model.entries.map(e => e.img).filter(Boolean))];
  const images = new Map();
  await Promise.all(sources.map(async (src) => {
    images.set(src, await loadImageAsJpeg(src));
  }));

  const bytes = buildPdf(model, images);

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(model.name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
