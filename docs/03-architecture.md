# 🏗️ Architecture

## Repository Layout

```text
.
+-- README.md
+-- backend/
|   +-- api/
|   |   +-- index.js
|   +-- config/
|   |   +-- device.yaml
|   |   +-- site.yaml
|   |   +-- device.json
|   |   +-- site.json
|   +-- packages/
|   |   +-- contracts/
|   +-- src/
|   |   +-- app.js
|   |   +-- server.js
|   |   +-- config-loader.js
|   |   +-- dependency-checker.js
|   |   +-- registry.js
|   |   +-- in-memory-bus.js
|   |   +-- lifecycle-orchestrator.js
|   |   +-- seed-runtime.js
|   |   +-- services/
|   +-- package.json
|   +-- vercel.json
+-- frontend/
|   +-- src/
|   +-- package.json
|   +-- vercel.json
+-- docs/
```

## Runtime Layers

| Layer | Responsibility | Current Files |
|---|---|---|
| Contracts | Define schemas and topic rules | `backend/packages/contracts` |
| Config | Load validated device/site runtime config | `backend/src/config-loader.js`, `backend/config/*.yaml` |
| Bus / Core | Publish/subscribe, registry, lifecycle, dependency checks | `backend/src` |
| Source | Produces frame envelopes | `backend/src/services/mock-source.js` |
| Module | Consumes frames, produces results | `backend/src/services/echo-module.js` |
| Sink | Consumes result topics | `backend/src/services/log-sink.js` |
| UI | Operator dashboard | `frontend/src` |

## Data Flow

```text
Mock Source
  +-- publishes camera.line1
###     +-- Echo Module subscribes camera.line1
###           +-- publishes result.echo
###                 +-- Log Sink subscribes result.*
```

## Control Flow

```text
Service registers
  +-- Registry validates service-registration.v1
###     +-- Service sends heartbeat
###           +-- Registry marks fresh/stale/alive
###                 +-- Dependency checker evaluates readiness
###                       +-- Dashboard renders state
```

## Config Flow

```text
config/device.yaml + config/site.yaml
  +-- config-loader validates shape with Zod
###     +-- seed runtime receives device/site config
###           +-- dashboard summary exposes loaded_from metadata
```

Config file precedence is:

```text
*.yaml -> *.yml -> *.json -> defaults
```

## Dependency Flow

```text
Registered services + module manifests + platform config
  +-- check configured device.runs services
  +-- check enabled site modules have manifests
  +-- check module service roles are running
  +-- check module input topics have publishers
  +-- check module config keys exist
###     +-- /api/dependencies and /api/dashboard-summary
```

## Lifecycle Flow

```text
Startup order:
core -> vision_runtime -> source -> module -> sink -> ui

Shutdown order:
ui -> sink -> module -> source -> vision_runtime -> core
```

The backend exposes both read-only plans and executable lifecycle commands:

| Route | Behavior |
|---|---|
| `GET /api/lifecycle/startup-plan` | Returns ordered startup state |
| `POST /api/lifecycle/startup` | Executes ordered startup transitions |
| `GET /api/lifecycle/shutdown-plan` | Returns ordered shutdown state |
| `POST /api/lifecycle/shutdown` | Publishes shutdown commands and marks services stopped |

## Deployment Architecture

| App | Deploy As | Notes |
|---|---|---|
| Backend | Vercel serverless API or Node service | Uses `backend/api/index.js` for Vercel |
| Frontend | Vercel static site | Uses `frontend/dist` output |

The apps can be deployed separately. The frontend uses `VITE_API_BASE_URL` when the backend is on another domain.
