# Atom Corvex — HTML / CSS / JS

Standalone operations desk (no React). Same UI as the original `localhost:5173` screen: dark top bar, Monitor nav, summary strip, 3D globe, filters, proximity feed.

## Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

## Files

| What you see | File |
|---|---|
| Page layout | `index.html` |
| Styles | `css/app.css`, `css/nav.css`, `css/markers.css` |
| App logic | `js/app.js` |
| Globe | `js/globe.js` |
| Satellite map | `js/map.js` |
| Events / assets | `js/data.js` |

Three.js and MapLibre load from CDN. Clicking a Proximity card stays on the globe and flies the camera to that event.
