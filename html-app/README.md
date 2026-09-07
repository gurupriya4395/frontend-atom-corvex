# Atom Corvex — HTML/CSS/JS

Plain **HTML, CSS, and JavaScript** version of the Atom Corvex operations desk. Same UI and behavior as the React app in `src/`, without React.

## Run

From the repo root (uses shared `node_modules` for Three.js and MapLibre):

```bash
npm install
npm run dev:html
```

Open http://localhost:5174

## Structure

| Path | Purpose |
|------|---------|
| `index.html` | Full UI shell (topbar, rails, feed, globe/map stages) |
| `css/app.css` | Main layout and ops theme |
| `css/markers.css` | TAK-style marker symbology |
| `js/main.js` | Entry point |
| `js/app.js` | State, filters, rendering, demo sequence |
| `js/globe.js` | Three.js globe |
| `js/map.js` | MapLibre satellite map |
| `js/data.js` | Sample events and assets |
| `js/scoring.js` | Enrichment and search |
| `js/markers.js` | Marker HTML builders |

## Keyboard shortcuts

- `/` — focus search
- `R` — run demo sequence
- `Escape` — clear selection and scene cues

## React version

The original React app still runs with `npm run dev` on port 5173.
