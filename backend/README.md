# 🖥️ Backend

The backend contains the platform core API, contracts, config, service registry, message bus, heartbeat loop, and lifecycle orchestration.

## 📁 Contents

| Path | Purpose |
|---|---|
| `src/app.js` | Express app and API routes |
| `src/server.js` | Local server entrypoint |
| `api/index.js` | Vercel serverless entrypoint |
| `src/registry.js` | Service/module registry and alive-check state |
| `src/in-memory-bus.js` | Publish/subscribe bus |
| `src/lifecycle-orchestrator.js` | Startup/shutdown sequencing |
| `src/services/` | Mock source, echo module, log sink |
| `packages/contracts/` | Shared contract schemas and bindings |
| `config/` | Device and site config |

## 🚀 Commands

```bash
npm install
npm run dev
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

More details: [Backend docs](../docs/06-backend.md)




