# 🖥️ Backend

## Purpose

The backend is the platform core. It owns contracts, runtime registration, topic messaging, health checks, config loading, dependency checks, and lifecycle sequencing.

## Folder Structure

```text
backend/
+-- api/
|   +-- index.js
+-- config/
|   +-- device.yaml
|   +-- site.yaml
|   +-- device.json
|   +-- site.json
+-- packages/
|   +-- contracts/
+-- src/
|   +-- app.js
|   +-- server.js
|   +-- config-loader.js
|   +-- dependency-checker.js
|   +-- registry.js
|   +-- in-memory-bus.js
|   +-- lifecycle-orchestrator.js
|   +-- seed-runtime.js
|   +-- services/
+-- package.json
+-- vercel.json
```

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install backend and contract dependencies |
| `npm run dev` | Start local API on port `7080` |
| `npm run test` | Run the Tier 1 loop test |
| `npm run build` | Run contracts, loop test, and API check |

## API Routes

| Route | Method | Purpose |
|---|---:|---|
| `/api/health` | GET | Core health probe |
| `/api/config` | GET | Current validated device/site config and source files |
| `/api/contracts` | GET | Contract names and canonical topics |
| `/api/dashboard-summary` | GET | Aggregated dashboard payload with dependency status and lifecycle plans |
| `/api/services` | GET | List registered services |
| `/api/services/register` | POST | Register a service |
| `/api/services/:serviceId/heartbeat` | POST | Update service heartbeat |
| `/api/services/:serviceId/shutdown` | POST | Request controlled shutdown for one service |
| `/api/modules` | GET | List module manifests |
| `/api/modules/register` | POST | Register a module manifest |
| `/api/modules/:moduleId/readiness` | GET | Check module needs/provides readiness |
| `/api/dependencies` | GET | Platform dependency report |
| `/api/lifecycle/startup-plan` | GET | Ordered startup plan |
| `/api/lifecycle/startup` | POST | Execute ordered startup |
| `/api/lifecycle/shutdown-plan` | GET | Ordered shutdown plan |
| `/api/lifecycle/shutdown` | POST | Execute ordered shutdown |
| `/api/bus` | GET | Bus snapshot |
| `/api/bus/messages` | GET | Retained messages |
| `/api/bus/subscriptions` | GET | Active subscriptions |
| `/api/bus/publish` | POST | Publish a message manually |
| `/api/source/capture` | POST | Trigger mock frame capture |
| `/api/sink/log` | GET | Read recent sink results |

## Config Loading

Config loading prefers YAML but keeps JSON/default compatibility:

```text
config/device.yaml -> config/device.yml -> config/device.json -> defaults
config/site.yaml   -> config/site.yml   -> config/site.json   -> defaults
```

The validated response from `/api/config` includes:

| Field | Meaning |
|---|---|
| `device` | Device identity, role, runnable services, and bus config |
| `site` | Site identity, enabled modules, sources, and sinks |
| `loaded_from` | Source file used for each config section |

## Dependency Checks

`/api/dependencies` returns an `ok` flag, summary counts, failed checks, module readiness, and all individual checks.

Checks cover:

- Services listed in `device.runs`.
- Manifests listed in `site.enabled_modules`.
- Manifest `needs.services` roles.
- Manifest `needs.input_topics` publishers.
- Manifest `needs.config_keys` existence.

## Lifecycle Sequencing

Startup order:

```text
core -> vision_runtime -> source -> module -> sink -> ui
```

Shutdown order:

```text
ui -> sink -> module -> source -> vision_runtime -> core
```

The plan endpoints are read-only. The `POST` endpoints execute ordered transitions and return per-service results.

## Runtime Services

| Service | Role | Publishes | Subscribes |
|---|---|---|---|
| Core Supervisor | `core` | `event.service.*` | `health.heartbeat` |
| Mock Camera Source | `source` | `camera.line1` | none |
| Echo Module | `module` | `result.echo` | `camera.line1` |
| Log Sink | `sink` | none | `result.*` |

## Important Notes

- The current bus is in-memory.
- The current runtime is a seed loop for development.
- Production multi-process deployments should replace the in-memory bus with Redis, NATS, Kafka, MQTT, or another broker.
