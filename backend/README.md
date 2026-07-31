# 🖥️ Backend

The backend contains the platform core API, contracts, YAML/JSON config loading, service registry, message bus, heartbeat loop, dependency checks, and lifecycle orchestration.

## 📁 Contents

| Path | Purpose |
|---|---|
| `src/app.js` | Express app and API routes |
| `src/server.js` | Local server entrypoint |
| `api/index.js` | Vercel serverless entrypoint |
| `src/config-loader.js` | Loads `device.yaml` / `site.yaml`, validates shape, falls back to JSON/defaults |
| `src/dependency-checker.js` | Platform dependency report for services, modules, topics, and config keys |
| `src/registry.js` | Service/module registry and alive-check state |
| `src/in-memory-bus.js` | Publish/subscribe bus |
| `src/lifecycle-orchestrator.js` | Ordered startup/shutdown plans and execution |
| `src/services/` | Mock source, echo module, log sink |
| `packages/contracts/` | Shared contract schemas and bindings |
| `config/` | Device and site config, preferring YAML |

## 🚀 Commands

```bash
npm install
npm run dev
npm run test
npm run build
```

## 🌐 Local URL

```text
http://localhost:7080
```

## ✅ Core Features

| Feature | Status |
|---|---:|
| Manifest needs/provides | ✅ |
| Pub/sub bus | ✅ |
| Service registration | ✅ |
| Heartbeat alive-check | ✅ |
| Startup/shutdown sequencing | ✅ |
| Config loading (device.yaml / site.yaml) | ✅ |
| Dependency checking | ✅ |

## 🔌 Key API Routes

| Route | Purpose |
|---|---|
| `GET /api/config` | Current validated config and source files |
| `GET /api/dependencies` | Platform dependency report |
| `GET /api/lifecycle/startup-plan` | Ordered startup plan |
| `POST /api/lifecycle/startup` | Execute ordered startup |
| `GET /api/lifecycle/shutdown-plan` | Ordered shutdown plan |
| `POST /api/lifecycle/shutdown` | Execute ordered shutdown |

More details: [Backend docs](../docs/06-backend.md)
