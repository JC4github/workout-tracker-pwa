# Muscle Map

A private, offline-first muscle-level workout tracker PWA. All training data is stored in the browser's IndexedDB on the device.

## Run locally

Use PowerShell from this folder:

```powershell
npm.cmd run dev
```

Open the displayed local address, normally `http://localhost:5173`.

## Build for deployment

```powershell
npm.cmd run build
```

Deploy the generated `dist` folder to an HTTPS static host such as Netlify, Vercel, Cloudflare Pages, or GitHub Pages. On an iPhone, open the deployed URL in Safari and use Share > Add to Home Screen.

## Included in this first build

- Clickable front and back SVG muscle maps
- Workout logging, ten-second undo, recovery colouring, and detail removal
- Personal-best records with training logs and a progress chart
- Notes with search, editing, and deletion
- IndexedDB persistence, JSON export, and JSON restore
- Offline PWA service worker and standalone manifest

## Important data note

Your training data is local to the browser/device. Export a JSON backup periodically, especially before clearing browser data or switching devices.
