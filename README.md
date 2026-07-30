# 🧠 BiztelAI Vision Intel Platform

A deployable vision-intelligence platform skeleton split into exactly two application folders:

| Folder | Purpose | Deploy Target |
|---|---|---|
| [`backend/`](./backend/) | Core API, service registry, pub/sub bus, heartbeats, lifecycle orchestration, contracts | Vercel Serverless Functions or Node server |
| [`frontend/`](./frontend/) | React operator dashboard for platform state, registry, health, and settings | Vercel Static Site |
| [`docs/`](./docs/) | Product, architecture, stack, deployment, and technical documentation | Project knowledge base |

## 🚀 Quick Start

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

## 📚 Documentation

| Document | What It Explains |
|---|---|
| [💡 Idea](./docs/01-idea.md) | Product vision, users, and platform purpose |
| [🧩 Problem](./docs/02-problem.md) | Why this platform exists and what pain it solves |
| [🏗️ Architecture](./docs/03-architecture.md) | Folder structure, runtime layers, and data flow |
| [🛠️ Tech Stack](./docs/04-tech-stack.md) | Frontend, backend, contracts, tooling, and deployment stack |
| [📜 Contracts](./docs/05-contracts.md) | Manifest spec, frame/result envelopes, topics, services, heartbeats |
| [🖥️ Backend](./docs/06-backend.md) | API routes, bus, registry, lifecycle, local commands |
| [🎛️ Frontend](./docs/07-frontend.md) | Dashboard views, design system, theme transition, API config |
| [🗄️ Database](./docs/08-database.md) | Current persistence status and future database plan |
| [☁️ Deployment](./docs/09-deployment.md) | Vercel deployment options for frontend and backend |
| [🛣️ Roadmap](./docs/10-roadmap.md) | What is implemented now and what comes next |
| [📦 Legacy Notes](./docs/legacy-index.md) | Older planning documents preserved for reference |

## ✅ Implemented P0 Scope

| P0 Item | Status | Location |
|---|---:|---|
| Manifest spec, per-module needs/provides | ✅ Done | `backend/packages/contracts` |
| Publish/subscribe messaging bus | ✅ Done | `backend/src/in-memory-bus.js` |
| Service registration | ✅ Done | `backend/src/registry.js` |
| Heartbeat / alive-check | ✅ Done | `backend/src/registry.js`, `backend/src/seed-runtime.js` |
| Startup/shutdown sequencing | ✅ Done | `backend/src/lifecycle-orchestrator.js` |

## ✅ Verification

Run these from each app folder:

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

## 🧭 Repository Shape

```text
.
+-- README.md
+-- backend/
+-- frontend/
+-- docs/
```

