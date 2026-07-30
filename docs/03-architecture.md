# 🏗️ Architecture

## Repository Layout

```text
.
+-- README.md
+-- backend/
¦   +-- api/
¦   ¦   +-- index.js
¦   +-- config/
¦   ¦   +-- device.json
¦   ¦   +-- site.json
¦   +-- packages/
¦   ¦   +-- contracts/
¦   +-- src/
¦   ¦   +-- app.js
¦   ¦   +-- server.js
¦   ¦   +-- registry.js
¦   ¦   +-- in-memory-bus.js
¦   ¦   +-- lifecycle-orchestrator.js
¦   ¦   +-- services/
¦   +-- package.json
¦   +-- vercel.json
+-- frontend/
¦   +-- src/
¦   +-- package.json
¦   +-- vercel.json
+-- docs/
```

## Runtime Layers

| Layer | Responsibility | Current Files |
|---|---|---|
| Contracts | Define schemas and topic rules | `backend/packages/contracts` |
| Bus / Core | Publish/subscribe, registry, lifecycle | `backend/src` |
| Source | Produces frame envelopes | `backend/src/services/mock-source.js` |
| Module | Consumes frames, produces results | `backend/src/services/echo-module.js` |
| Sink | Consumes result topics | `backend/src/services/log-sink.js` |
| UI | Operator dashboard | `frontend/src` |

## Data Flow

```text
Mock Source
  +-- publishes camera.line1
        +-- Echo Module subscribes camera.line1
              +-- publishes result.echo
                    +-- Log Sink subscribes result.*
```

## Control Flow

```text
Service registers
  +-- Registry validates service-registration.v1
        +-- Service sends heartbeat
              +-- Registry marks fresh/stale/alive
                    +-- Dashboard renders state
```

## Lifecycle Flow

```text
Startup order:
core ? vision_runtime ? source ? module ? sink ? ui

Shutdown order:
ui ? sink ? module ? source ? vision_runtime ? core
```

## Deployment Architecture

| App | Deploy As | Notes |
|---|---|---|
| Backend | Vercel serverless API or Node service | Uses `backend/api/index.js` for Vercel |
| Frontend | Vercel static site | Uses `frontend/dist` output |

The apps can be deployed separately. The frontend uses `VITE_API_BASE_URL` when the backend is on another domain.



