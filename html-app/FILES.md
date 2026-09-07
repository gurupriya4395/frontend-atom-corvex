# HTML / CSS / JS files for localhost:5173

The app at **http://localhost:5173/** is the **React** version.

These files are the **same UI and behavior** in plain HTML, CSS, and JavaScript:

## File map (React → HTML)

| What you see on :5173 | HTML/CSS/JS file |
|----------------------|------------------|
| Page layout | `index.html` |
| All styles | `css/app.css` |
| Marker pins | `css/markers.css` |
| App logic (filters, feed, demo) | `js/app.js` |
| Globe (3D earth) | `js/globe.js` |
| Map (satellite) | `js/map.js` |
| Events & assets data | `js/data.js` |
| Scoring & search | `js/scoring.js` |
| Marker HTML | `js/markers.js` |
| Labels | `js/labels.js` |
| Coordinates | `js/coords.js` |
| Demo sequence | `js/sequence.js` |
| Entry point | `js/main.js` |

## Download zip

https://github.com/gurupriya4395/frontend-atom-corvex/raw/cursor/globe-pins-light-bg-a1f5/html-app.zip

```bash
cd ~/Downloads
curl -L -o html-app.zip "https://github.com/gurupriya4395/frontend-atom-corvex/raw/cursor/globe-pins-light-bg-a1f5/html-app.zip"
unzip html-app.zip
cd html-app
npx --yes serve .
```

Open **http://localhost:3000** (same app, plain HTML/CSS/JS).

## Open in VS Code

```bash
code html-app/atom-corvex-html.code-workspace
```
