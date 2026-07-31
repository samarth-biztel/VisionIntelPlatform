# Vision Intel Platform

A deployable vision-intelligence platform skeleton split into two application folders: a Rust backend platform core and a frontend operator dashboard.

Language decisions are binding in [Language Policy](./docs/legacy-languages.md). The Core is **Rust** because it owns supervisor duties and the future shared-memory frame transport. JavaScript remains only where the policy allows it: contract bindings for JS consumers and the React frontend.

| Folder | Purpose | Deploy Target |
|---|---|---|
| [`backend/`](./backend/) | Rust Core API, service registry, pub/sub bus, heartbeats, config loading, dependency checks, lifecycle orchestration, contracts | Long-running Rust service |
| [`frontend/`](./frontend/) | React operator dashboard; this is the web frontend half of the later Tauri desktop UI | Vercel Static Site now, Tauri shell later |
| [`docs/`](./docs/) | Product, architecture, stack, deployment, and technical documentation | Project knowledge base |

## Quick Start

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend API runs on:

```text
http://localhost:7080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

## Documentation

| Document | What It Explains |
|---|---|
| [Idea](./docs/01-idea.md) | Product vision, users, and platform purpose |
| [Problem](./docs/02-problem.md) | Why this platform exists and what pain it solves |
| [Architecture](./docs/03-architecture.md) | Folder structure, runtime layers, data flow, lifecycle flow |
| [Tech Stack](./docs/04-tech-stack.md) | Frontend, backend, contracts, tooling, and deployment stack |
| [Contracts](./docs/05-contracts.md) | Manifest spec, frame/result envelopes, topics, services, heartbeats |
| [Backend](./docs/06-backend.md) | API routes, bus, registry, config, dependency checks, lifecycle |
| [Frontend](./docs/07-frontend.md) | Dashboard views, design system, theme transition, API config |
| [Database](./docs/08-database.md) | Current persistence status and future database plan |
| [Deployment](./docs/09-deployment.md) | Deployment options for the Rust backend and web frontend |
| [Roadmap](./docs/10-roadmap.md) | What is implemented now and what comes next |
| [Legacy Notes](./docs/legacy-index.md) | Older planning documents preserved for reference |
| [Language Policy](./docs/legacy-languages.md) | Binding language decisions, known deviations, and porting order |

## Implemented P0 Scope

| P0 Item | Status | Location |
|---|---:|---|
| Manifest spec, per-module needs/provides | Done | `backend/packages/contracts` |
| Publish/subscribe messaging bus | Done | `backend/src/main.rs` |
| Service registration | Done | `backend/src/main.rs` |
| Heartbeat / alive-check | Done | `backend/src/main.rs` |
| Startup/shutdown sequencing | Done | `backend/src/main.rs`, `/api/lifecycle/*` |
| Config loading (device.yaml / site.yaml) | Done | `backend/src/main.rs`, `backend/config/*.yaml` |
| Dependency checking | Done | `backend/src/main.rs`, `/api/dependencies` |
| Rust contract binding | Done | `backend/packages/contracts/bindings/rust` |

## Verification

Run these from each app folder:

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

## Repository Shape

```text
.
+-- README.md
+-- backend/
+-- frontend/
+-- docs/
```