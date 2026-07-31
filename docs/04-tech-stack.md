# Tech Stack

## Overview

| Area | Technology | Why |
|---|---|---|
| Frontend | React 18 | Component-based dashboard UI |
| Frontend build | Vite | Fast local development and static builds |
| Styling | Tailwind CSS | Utility classes with consistent design tokens |
| Icons | Lucide React | Clean, accessible UI icons |
| Motion | Framer Motion + View Transitions API | Dashboard entrance motion and theme reveal animation |
| Core backend | Rust | Binding decision because Core owns supervision and shared-memory frame transport |
| Backend compatibility scripts | npm | Keeps existing `npm run dev/build` workflow while invoking Cargo |
| Config | YAML preferred, JSON/default fallback | Human-readable site/device config with backward compatibility |
| Contracts | Shared fixtures + JavaScript/Python/Rust bindings | Schemas are language-neutral; no binding is primary |
| Future contract binding | C++ | Add when the Vision Runtime needs a native binding |
| Deployment | Rust service for backend; Vercel static frontend now; Tauri shell later | Matches the split between Core and UI |

## Frontend Stack

```text
React -> Vite -> Tailwind -> Vercel static output -> later Tauri shell
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

## Backend Core

```text
Rust HTTP API -> Config Loader -> Registry -> Bus -> Dependency Checker -> Lifecycle -> Seed Runtime -> Contracts
```

The backend runtime is now Rust. The JavaScript code under `backend/packages/contracts/bindings/javascript/` is a contract binding for JavaScript consumers, not the backend implementation.

Key backend files:

| File | Purpose |
|---|---|
| `backend/src/main.rs` | Rust Core API, registry state, bus snapshot, lifecycle handling, and seed mock flow |
| `backend/Cargo.toml` | Rust backend package |
| `backend/.cargo/config.toml` | Backend-local GNU target config |
| `backend/scripts/cargo-gnu.ps1` | Adds Rust's bundled GNU tools to PATH before Cargo runs |
| `backend/packages/contracts/bindings/rust` | Rust contract binding used by the Core |
| `backend/packages/contracts/bindings/python` | Python contract binding for ML/vision modules |
| `backend/packages/contracts/bindings/javascript` | JavaScript contract binding for JS consumers and UI-facing checks |

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
| `backend/package.json` | Backend command wrapper and contracts workspace |
| `frontend/package.json` | Frontend app |

This keeps frontend deployment simple while preserving familiar backend commands for Rust checks.

## Python Floor

All Python code targets Python 3.8 for JetPack 5.1 and must run unchanged on JetPack 6 (3.10) and Windows (3.11). Use `Optional[X]`, `Union[X, Y]`, `List[T]`, and `Dict[K, V]`; avoid `X | Y`, builtin generic annotations such as `list[str]`, and `match`.