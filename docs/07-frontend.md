# Frontend

## Purpose

The frontend is the operator dashboard for the Vision Intel Platform. It gives a fast visual read of service health, registry state, bus activity, lifecycle order, dependency status, and deployment settings.

Per [legacy-languages.md](legacy-languages.md), the desktop UI target is Tauri: this React/Vite app is the web frontend half, and the Rust shell is deferred.

## Folder Structure

```text
frontend/
+-- index.html
+-- package.json
+-- vite.config.js
+-- tailwind.config.js
+-- postcss.config.js
+-- vercel.json
+-- src/
### +-- App.jsx
### +-- main.jsx
### +-- components/
### +-- data/
### +-- lib/
### +-- styles/
```

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install frontend dependencies |
| `npm run dev` | Start Vite on port `5173` |
| `npm run build` | Build static site into `dist` |
| `npm run preview` | Preview production build locally |

## Dashboard Views

| View | Purpose |
|---|---|
| Dashboard | Full overview of services, modules, bus, contracts, lifecycle, and dependencies |
| Registry | Focused view of services, contracts, and module count |
| Health | Alive-check status and lifecycle sequencing |
| Settings | Device/site config, loaded config source files, and deployment details |

## Dashboard Data Contract

The frontend primarily reads:

```text
/api/dashboard-summary
```

The summary includes:

| Field | Purpose |
|---|---|
| `registry` | Counts of healthy, degraded, error, stopped, service, and module records |
| `services` | Decorated service records with heartbeat freshness |
| `modules` | Registered module manifests |
| `config` | Device/site identity, enabled modules, and loaded config source files |
| `bus` | Retained messages, subscribers, and transport snapshot |
| `lifecycle` | Startup and shutdown plans |
| `dependencies` | Platform dependency report |

## Design System

| Element | Current Pattern |
|---|---|
| Cards | Thin border, small radius, restrained dashboard styling |
| Icons | Lucide React icons |
| Sidebar | Collapsible, icon-centered rail in collapsed mode |
| Theme | Light/dark mode with circular transition from the toggle button |
| Status | Compact table rows with small dots and subtle pills |

## API Configuration

By default, the frontend calls same-origin API routes:

```text
/api/dashboard-summary
```

For separate deployments, set this Vercel environment variable in the frontend project:

```text
VITE_API_BASE_URL=https://your-backend-domain.vercel.app
```

Local Vite development proxies `/api` to:

```text
http://localhost:7080
```

## Offline Fallback

If the API is unavailable, the frontend renders `frontend/src/data/fallback-summary.js` and marks the dashboard as local fallback. This keeps the interface inspectable during frontend-only work.
