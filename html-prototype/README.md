# HTML prototype (standalone)

This folder is **separate from the React app** in `src/`. Edit HTML/CSS/JS here without touching the production React code.

## Open in browser

**Option 1 — double-click**
- Open `index.html` in Chrome or Firefox

**Option 2 — simple server (recommended)**
```bash
cd html-prototype
npx --yes serve .
# open http://localhost:3000
```

**Option 3 — Python**
```bash
cd html-prototype
python3 -m http.server 8080
# open http://localhost:8080
```

## Folder layout

```
html-prototype/
  index.html      ← page structure
  css/desk.css    ← styles (safe to experiment)
  js/desk.js      ← mock data + simple interactions
```

## React app (unchanged)

The real app still runs from the repo root:

```bash
npm install
npm run dev
```
