# CreativeNotes

A polished desktop notebook app built with Electron — draw, sketch, and take notes across multiple notebooks and pages, with a clean frameless UI, dark/light themes, and smooth freehand drawing.

---

## Features

### 📚 Notebook library
- Create, rename, and delete notebooks with custom cover colours
- Search notebooks by name
- Live preview thumbnail of the first page on each notebook card
- Sorted by last-edited time

### 📄 Pages
- Add and delete pages per notebook
- Page styles per page: **Blank · Lined · Dotted · Grid**
- Page background colour — 10 presets or any custom hex colour
- Thumbnail rail on the left (collapsible with `\` or the sidebar button)
- Smooth scroll-snap between pages
- Footer indicator showing current page number

### ✏️ Drawing tools
| Tool | Shortcut |
|---|---|
| Pen (smooth freehand) | `P` |
| Eraser (segment-level) | `E` |
| Line | `L` |
| Rectangle | `R` |
| Rounded rectangle | — |
| Ellipse | `O` |
| Triangle | — |
| Diamond | — |
| Arrow | — |
| Double arrow | — |
| Star | — |

- **Smooth pen** — quadratic bezier through midpoints, same algorithm as Microsoft Whiteboard
- **Segment eraser** — splits strokes instead of deleting them whole
- **Colour picker** — 48-colour palette grid + custom hex input
- **Size presets** (Thin / Medium / Thick) + continuous range slider
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Shift+Z`
- **Clear page**

### 🔍 Zoom
| Action | Shortcut |
|---|---|
| Zoom in | `Ctrl++` |
| Zoom out | `Ctrl+-` |
| Reset to 100% | `Ctrl+0` |
| Fit width → height → reset (cycle) | Click the % label |
| Scroll zoom | `Ctrl+Scroll` |

### 🎨 Themes
- Light and dark theme, toggled from the title bar
- Persisted across sessions via `localStorage`
- Pages always stay white regardless of theme

### 💾 Data & export
- Auto-saves every 800 ms of inactivity to `creativenotes.json` in the system userData folder
- Final flush on window close (`beforeunload`)
- **Export PDF** — renders all page drawings at full resolution into a clean A4 PDF (no headers, no page numbers)

### 🖥️ Window
- Frameless window with custom title bar and window controls (minimize / maximize / close)
- Minimum window size: 1100 × 720

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `P` | Pen tool |
| `E` | Eraser tool |
| `L` | Line shape |
| `R` | Rectangle shape |
| `O` | Ellipse shape |
| `\` | Toggle sidebar |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `↑ / PgUp` | Previous page |
| `↓ / PgDn` | Next page |
| `Esc` | Back to library |

---

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- npm

### Run in development
```powershell
npm install
npm start
```

### Build a Windows installer
```powershell
npm install
npm run dist
```

The installer (`CreativeNotes Setup 1.0.0.exe`) will be placed in the `dist/` folder.  
It gives the user a choice of install directory, creates a Desktop shortcut and a Start Menu entry.

To build an unpacked directory instead (faster, no installer):
```powershell
npm run dist:dir
```

---

## Project structure

```
creativenotes/
├── logo.ico          ← App icon (Windows)
├── logo.png          ← Logo used in title bar
├── package.json      ← electron-builder config + scripts
└── src/
    ├── main.js       ← Electron main process (window, IPC, PDF export, data I/O)
    ├── preload.js    ← Context bridge (load, save, exportPdf, window controls)
    ├── index.html    ← App shell — title bar, toolbar, sidebar, scroller
    ├── renderer.js   ← All UI logic (~680 lines)
    └── styles.css    ← Light + dark themes, all component styles
```

### Data file location

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\creativenotes\creativenotes.json` |
| macOS | `~/Library/Application Support/creativenotes/creativenotes.json` |
| Linux | `~/.config/creativenotes/creativenotes.json` |
