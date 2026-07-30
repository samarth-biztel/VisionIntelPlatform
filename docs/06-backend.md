# 🖥️ Backend

## Purpose

The backend is the platform core. It owns contracts, runtime registration, topic messaging, health checks, and lifecycle sequencing.

## Folder Structure

```text
backend/
+-- api/
¦   +-- index.js
+-- config/
¦   +-- device.json
¦   +-- site.json
+-- packages/
¦   +-- contracts/
+-- src/
¦   +-- app.js
¦   +-- server.js
¦   +-- registry.js
¦   +-- in-memory-bus.js
¦   +-- lifecycle-orchestrator.js
¦   +-- seed-runtime.js
¦   +-- services/
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
| `/api/config` | GET | Current device/site config |
| `/api/contracts` | GET | Contract names and canonical topics |
| `/api/dashboard-summary` | GET | Aggregated dashboard payload |
| `/api/services` | GET | List registered services |
| `/api/services/register` | POST | Register a service |
| `/api/services/:serviceId/heartbeat` | POST | Update service heartbeat |
| `/api/services/:serviceId/shutdown` | POST | Request controlled shutdown |
| `/api/modules` | GET | List module manifests |
| `/api/modules/register` | POST | Register a module manifest |
| `/api/modules/:moduleId/readiness` | GET | Check module needs/provides readiness |
| `/api/lifecycle/startup-plan` | GET | Ordered startup plan |
| `/api/lifecycle/shutdown-plan` | GET | Ordered shutdown plan |
| `/api/bus` | GET | Bus snapshot |
| `/api/bus/messages` | GET | Retained messages |
| `/api/bus/subscriptions` | GET | Active subscriptions |
| `/api/bus/publish` | POST | Publish a message manually |
| `/api/source/capture` | POST | Trigger mock frame capture |
| `/api/sink/log` | GET | Read recent sink results |

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



