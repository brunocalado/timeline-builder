# Timeline Builder

**Timeline Builder** allows you to create and display beautiful, interactive timelines for your Foundry VTT campaign. Perfect for tracking world history, plot arcs, or character backgrounds.

## ✨ Features

- **Horizontal View**: Scroll through history with a sleek, interactive interface.
- **Visual Effects**: Highlight important events with effects like **Glow**, **Pulse**, **Shake**, **Float**, or **Glitch**.
- **Flexible Time**: Track events by **Date**, **Time**, or **Free Text** (e.g., "The Age of Myth").
- **Images & Layout**: Add images to events, displayed in a stylish zig-zag pattern.
- **Privacy**: GMs can hide specific timelines or events from players to prevent spoilers.
- **Organization**: Use **Tags** and **Colors** to categorize and filter events.

## 🚀 How to Use

### Opening the Timeline
Access the timeline via the **Scene Controls** (left toolbar):
1.  Select the **Notes** category (pin icon).
2.  Click the **Timeline** tool (clock icon).

- **Left Click**: Opens the **Viewer** (for players and GMs).
- **GM Access**: The GM view includes the **Manager** to create and edit content.

### Managing Content (GM)
1.  **Create**: Make separate timelines for different eras or stories.
2.  **Edit**: Add events with titles, dates, descriptions, and images.
3.  **Sort**: Events are automatically sorted chronologically based on your settings.
4.  **Filter**: Players can use the filter menu to find specific tags (e.g., "Battles").

## 💻 API Commands
For use in macros or scripts:

```javascript
Timeline.Open();   // Open Viewer
Timeline.Manage(); // Open Manager (GM only)
```

## 📦 Installation
1. Install the module via the Foundry VTT setup screen.
2. Enable the module in your world settings.
3. Start building your history!

---
*Created for Foundry VTT.*