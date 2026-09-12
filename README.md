# ATOM-CORVEX Operations

http://localhost:5173 is the **HTML / CSS / JS** operations desk (light mission chrome, full 3D globe, filters, proximity feed).

## Run

```bash
git fetch origin
git checkout cursor/html-exact-5173-a1f5
git pull origin cursor/html-exact-5173-a1f5
npm install
npm run dev
```

Open **http://localhost:5173**

Stop any old Vite process first (`Ctrl+C`). If Git says branches diverged:

```bash
git reset --hard origin/cursor/html-exact-5173-a1f5
npm run dev
```

## Files (exact UI)

| What you see | File |
|---|---|
| Page layout | `html-app/index.html` |
| Styles | `html-app/css/app.css`, `nav.css`, `markers.css` |
| App logic | `html-app/js/app.js` |
| Globe | `html-app/js/globe.js` |
| Satellite map | `html-app/js/map.js` |
| Events / assets | `html-app/js/data.js` |

Clicking a Proximity card keeps **Globe** view and flies the camera to that event.

## Optional React copy

```bash
npm run dev:react
```

That serves the React source on **http://localhost:5175**. The HTML app on 5173 is the default.

## Stack

- **UI:** HTML + CSS
- **Logic:** vanilla JavaScript
- **Dev server:** Vite 8
- **3D globe:** Three.js
- **Terrain map:** MapLibre GL
- **No backend** — sample events in `html-app/js/data.js`
