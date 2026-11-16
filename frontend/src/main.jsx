import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import App from './App.jsx';
import './styles/index.css';

// MapLibre 6 discovers its module worker at runtime. Vite cannot include that
// dynamically constructed URL in a production build, so Railway previously
// returned index.html for /assets/maplibre-gl-worker.mjs. Bundle the worker
// explicitly and point every map instance at the emitted, hashed asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
