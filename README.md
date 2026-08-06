# Timeline Builder

**Timeline Builder** transforms your world's history into a stunning, interactive horizontal scroll. Transform dry dates and notes into an immersive experience that players will love to explore. Perfect for tracking campaign arcs, world lore, or character backstories.

<p align="center"><img width="900" src="docs/preview.webp" alt="Timeline View"></p>

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-Donate-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/mestredigital) [![More Modules](https://img.shields.io/badge/Foundry%20VTT-More%20Modules-red?style=for-the-badge&logo=gamepad)](https://mestredigital.online/pages/projetos-en)

## ✨ Key Features

- **🎨 Immersive Visualization**: Display events in a sleek, "zig-zag" horizontal layout. Features drag-to-scroll navigation and a built-in lightbox for inspecting maps and artwork.
- **✨ Dynamic Visual Effects**: Make legendary events stand out! Apply animated effects like **Glow**, **Pulse**, **Neon**, **Glitch**, and **Chroma** to specific entries.
- **🛠️ Total Customization**: Style your timeline to match your setting. Choose from different **Line Styles** (Solid, Dashed, Rough/Ink), **Dot Shapes**, and custom colors for every element.
- **🕵️ Mystery Mode**: Tease your players with "Redacted" information. Show that an event occurred but hide the specific date, description, or image until the big reveal.
- **🔗 Deep Integration**: Connect events directly to **Journal Entries**. A single click transports players from the timeline to the full lore page.
- **🏷️ Powerful Organization**: Use **Tags** to categorize events (e.g., "War", "Politics", "Personal") and let players filter the view to see exactly what matters to them.
- **👑 GM Control**: Manage what players see with granular visibility settings. Hide entire timelines or specific events, and use **Broadcast** to show a timeline to all connected players instantly.
- **📄 PDF Export**: Turn any timeline into a clean, shareable document. Click the **PDF** button in the Manager to download a paginated file with every event's timeframe, title, description, tags, and images.
- **📤 Import / Export**: Back up timelines or move them to another world. Open **Configure Settings → Import / Export** to export any selection of timelines as a JSON file, then import them elsewhere — id conflicts are detected automatically, letting you skip, replace, or import as a copy.

## 🚀 Getting Started

1.  **Access**: Go to the **Notes Layer** (left toolbar) and click the **Timeline** (clock) icon.

<p align="center"><img width="600" src="docs/howtoopen.webp"></p>

You can also use macros:

```js
Timeline.Open();
```

```js
Timeline.Manage();
```

2.  **Create (GM)**: Use the Manager to build timelines, add events, and drag-and-drop to reorder.

<p align="center"><img width="600" src="docs/settings.webp"></p>

3.  **Customize**: Pick your theme colors, line styles, and apply special effects to key moments.
4.  **Share**: Players can open the viewer to explore the history you've created!

## 🚀 Installation

Install via the Foundry VTT Module browser or use this manifest link:

```js
https://raw.githubusercontent.com/brunocalado/timeline-builder/main/module.json
```

## ⚖️ Credits and License

* **Code License:** GNU GPLv3.