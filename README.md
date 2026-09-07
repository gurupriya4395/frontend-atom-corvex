# ATOM-CORVEX Operations POC

GSOC watch floor: 3D globe, animated hazards, asset and Deutsche Bank HQ proximity, explainable impact score.

## Run the HTML app (same UI as localhost:5173)

The default app is now **plain HTML/CSS/JS** in `html-app/`. It matches the React operations desk (dark top bar, summary, globe, filters, proximity feed).

```bash
git fetch origin
git checkout cursor/globe-pins-light-bg-a1f5
git pull origin cursor/globe-pins-light-bg-a1f5
npm install
npm run dev
```

Open **http://localhost:5173**

If Git says branches diverged:

```bash
git reset --hard origin/cursor/globe-pins-light-bg-a1f5
npm run dev
```

Stop any old server first (`Ctrl+C`), then start `npm run dev` again.

## Open HTML files in VS Code

**File → Open Workspace from File…** → `html-app/atom-corvex-html.code-workspace`

## React version (optional)

```bash
npm run dev:react
```

## HTML prototype (layout sandbox)

Static mock UI in **`html-prototype/`** — not the full app.

```bash
cd html-prototype
npx --yes serve .
```

## Run in Cursor (VS Code-style layout)

### Option A — Workspace file (recommended)

1. Clone the repo and checkout the feature branch:
   ```bash
   git clone https://github.com/gurupriya4395/frontend-atom-corvex.git
   cd frontend-atom-corvex
   git checkout cursor/globe-pins-light-bg-a1f5
   npm install
   ```
2. In Cursor Desktop: **File → Open Workspace from File…**
3. Select `atom-corvex.code-workspace` in the repo root.
4. You get the familiar layout: **Explorer on the left**, full files in the editor, tabs on top.
5. Start the app:
   - **Terminal → Run Task → dev**, or
   - `npm run dev`
6. Open http://localhost:5173

### Option B — Open folder

1. **File → Open Folder…** and choose the repo.
2. **View → Explorer** (`Cmd+Shift+E` / `Ctrl+Shift+E`) for the file tree on the left.
3. `npm install && npm run dev`

### Review changes vs main

- **Source Control** panel → view diffs side-by-side
- Or: `git diff main`
- PR: https://github.com/gurupriya4395/frontend-atom-corvex/pull/2

## Run (quick)

```bash
npm install
npm run dev
```

Open the printed local URL (port 5173).

## Stack

- **UI:** React 19
- **Bundler / dev server:** Vite 8
- **3D globe:** Three.js
- **Terrain map:** MapLibre GL
- **Styling:** CSS (no Tailwind / no UI kit)
- **No backend** — sample events in `src/data.js`

## Demo path

1. Boot, then Floor with the globe.
2. Proximity: Mumbai flood / Thane fire.
3. Terrain map (Live / Forecast): Deutsche Bank HQ radii and HQ → incident time.
4. Acknowledge to clear the bell.
