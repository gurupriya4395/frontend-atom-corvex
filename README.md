# ATOM-CORVEX Operations POC

GSOC watch floor: 3D globe, animated hazards, asset and Deutsche Bank HQ proximity, explainable impact score.

This repository contains the standalone ATOM-CORVEX frontend.

## Run in Cursor

1. Clone or pull the `main` branch.
2. **File → Open Folder** and choose the cloned `frontend-atom-corvex` folder.
3. In the terminal:

From the repository root:

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
