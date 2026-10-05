# Atom Corvex — HTML / CSS / JS

Standalone operations desk (no React). All page, style, and script files live in **`html-app/`**.

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

In VS Code: **File → Open Folder…** and select **`html-app`**.

## Files

| What you see | File |
|---|---|
| Page layout | `html-app/index.html` |
| Styles | `html-app/css/app.css`, `html-app/css/nav.css`, `html-app/css/markers.css` |
| App logic | `html-app/js/app.js` |
| Globe | `html-app/js/globe.js` |
| Satellite map | `html-app/js/map.js` |
| Events / assets | `html-app/js/data.js` |

Three.js and MapLibre load from CDN. Clicking a Proximity card stays on the globe and flies the camera to that event.
