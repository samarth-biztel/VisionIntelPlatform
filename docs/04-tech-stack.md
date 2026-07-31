# 🛠️ Tech Stack

## Overview

| Area | Technology | Why |
|---|---|---|
| Frontend | React 18 | Component-based dashboard UI |
| Frontend build | Vite | Fast local development and static builds |
| Styling | Tailwind CSS | Utility classes with consistent design tokens |
| Icons | Lucide React | Clean, accessible UI icons |
| Motion | Framer Motion + View Transitions API | Dashboard entrance motion and theme reveal animation |
| Backend | Node.js + Express | Simple HTTP API and local runtime host |
| Validation | Zod | Runtime contract and config validation in JavaScript |
| Config | YAML preferred, JSON/default fallback | Human-readable site/device config with backward compatibility |
| Contracts | JavaScript + Python bindings | Shared schemas for module authors |
| Deployment | Vercel | Static frontend and serverless backend support |

## Frontend Stack

```text
React -> Vite -> Tailwind -> Vercel static output
```

Key frontend files:

| File | Purpose |
|---|---|
| `frontend/src/App.jsx` | Main dashboard and view switching |
| `frontend/src/components/Sidebar.jsx` | Sidebar navigation and collapse control |
| `frontend/src/components/TopNav.jsx` | Header, search trigger, theme toggle |
| `frontend/src/styles/index.css` | Theme tokens, transitions, Tailwind layers |
| `frontend/src/lib/api.js` | API client and offline fallback |
| `frontend/src/data/fallback-summary.js` | Local dashboard data when API is unavailable |

## Backend Stack

```text
Express API -> Config Loader -> Registry -> Bus -> Dependency Checker -> Lifecycle -> Seed Runtime -> Contracts
```

Key backend files:

| File | Purpose |
|---|---|
| `backend/src/app.js` | Express app and API routes |
| `backend/src/server.js` | Local Node server entry |
| `backend/api/index.js` | Vercel serverless entry |
| `backend/src/config-loader.js` | Loads and validates device/site config |
| `backend/src/dependency-checker.js` | Reports missing services, topics, modules, and config keys |
| `backend/src/registry.js` | Service and module registry |
| `backend/src/in-memory-bus.js` | Topic pub/sub bus |
| `backend/src/lifecycle-orchestrator.js` | Startup/shutdown sequencing and execution |
| `backend/src/seed-runtime.js` | Mock source -> echo module -> log sink loop |

## Config Strategy

The backend config loader checks files in this order:

```text
config/device.yaml
config/device.yml
config/device.json
defaults

config/site.yaml
config/site.yml
config/site.json
defaults
```

The loaded config is validated before the app starts and exposed through `/api/config` with `loaded_from` metadata.

## Package Strategy

The repository is intentionally no longer a root npm workspace. Each deployable app owns its package file:

| Folder | Package Role |
|---|---|
| `backend/package.json` | Backend app and contracts workspace |
| `frontend/package.json` | Frontend app |

This keeps Vercel deployment simpler: choose either `backend` or `frontend` as the project root.
