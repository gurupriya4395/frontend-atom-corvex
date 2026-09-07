# Atom Corvex — HTML only

Plain **HTML, CSS, and JavaScript** — no React, no build step. Same UI and behavior as the React app.

## Open in VS Code / Cursor

1. **File → Open Workspace from File…**
2. Select **`atom-corvex-html.code-workspace`** in this folder

You will only see `html-app` files (not the React `src/` folder).

## Run

Use any static file server (required for ES modules):

```bash
cd html-app
npx --yes serve .
```

Open the URL shown (usually http://localhost:3000).

**VS Code:** install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | UI shell + CDN links for Three.js & MapLibre |
| `css/` | Layout and ops theme |
| `js/` | App logic, globe, map, data |

Three.js and MapLibre load from CDN — no `npm install` needed in this folder.

## Shortcuts

- `/` — focus search
- `R` — run demo
- `Escape` — clear selection
