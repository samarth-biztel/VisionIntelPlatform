# BiztelAI Vision Intel Platform

> **One industrial QC platform. Many independent modules. Shared contracts.**

BiztelAI Vision Intel Platform is a pluggable platform for industrial inspection and QC products. The
goal is to avoid building every product as a separate standalone app with its own camera handling,
configuration, logging, persistence, model loading, and UI.

Instead:

**Core supervises · Bus carries · Sources normalize · Modules process · Sinks act · Vision Runtime runs GPU inference**

---

## 🚦 Current Status

| Area | Status |
|---|---|
| Architecture | ✅ Designed |
| Root documentation | ✅ Available |
| Codebase | 🟡 Started |
| Samarth-owned implementation | 🟢 First slice implemented |
| Chetak-owned CV/GPU implementation | 🔴 Not started |
| Real hardware integration | 🔴 Not started |

---

## ✅ Implemented Till Now

### 👤 Samarth

Currently implemented Samarth-owned platform items:

| Item | Status | Location | Notes |
|---|---:|---|---|
| **Bus topic naming convention** | ✅ Implemented | `packages/contracts/src/bus-topics.js` | Validates topic families like `camera.*`, `result.*`, `control.*`, `event.*`, `health.*` |
| **Service interface** | ✅ Implemented | `packages/contracts/src/service-interface.js` | Defines `register`, `heartbeat`, `shutdown`, and service health/state contracts |

Service interface coverage:

| Capability | Status |
|---|---:|
| Service registration schema | ✅ |
| Heartbeat schema | ✅ |
| Shutdown command schema | ✅ |
| Runtime state / health states | ✅ |
| API route: register service | ✅ |
| API route: heartbeat | ✅ |
| API route: list services | ✅ |
| API route: health check | ✅ |
| Real shutdown process handling | ⏳ Pending |

---

## 🧱 What Has Been Scaffolded

| Layer | What Exists |
|---|---|
| `packages/contracts` | Shared Zod schemas and validation helpers |
| `apps/api` | Express-based Core API skeleton |
| `apps/web` | React/Vite operator dashboard shell |
| `config` | Initial `device.json` and `site.json` |

The current implementation is intentionally small: it establishes the first shared language and
control-plane surface before real cameras, models, PLCs, or databases are added.

---

## 📁 Project Structure

```txt
.
├── apps/
│   ├── api/                 # Express Core API skeleton
│   └── web/                 # React operator dashboard
├── config/
│   ├── device.json          # What runs on this machine
│   └── site.json            # Site/module/source configuration
├── packages/
│   └── contracts/           # Global schemas and platform contracts
├── ARCHITECTURE.md          # Chosen architecture
├── CONTEXT.md               # Current state, build order, tracker notes
├── MEMORY.md                # Durable facts and invariants
├── PROBLEM_STATEMENT.md     # Why this platform exists
└── README.md
```

---

## 🧠 Platform Mental Model

| Role | Responsibility |
|---|---|
| **Core** | Supervises config, registry, lifecycle, health, and UI shell |
| **Bus** | Dumb pub/sub transport by topic |
| **Source Services** | Capture frames, normalize them, publish canonical frame topics |
| **Module Services** | Subscribe to inputs, process, publish results |
| **Sink Services** | Subscribe to results and act, such as PLC write, logging, alerts |
| **Vision Runtime** | Shared GPU inference machinery for modules that need it |
| **Contracts** | The global language every component obeys |

The most important rule:

> Services know only their input and output **topics**, never another service's identity or location.

---

## 🧾 Current Contracts

| Contract | Status | File |
|---|---:|---|
| Bus topics | ✅ | `packages/contracts/src/bus-topics.js` |
| Frame envelope | ✅ | `packages/contracts/src/frame-envelope.js` |
| Result envelope | ✅ | `packages/contracts/src/result-envelope.js` |
| Service interface | ✅ | `packages/contracts/src/service-interface.js` |
| Module interface / manifest | ✅ | `packages/contracts/src/module-interface.js` |
| Inference contract | ✅ | `packages/contracts/src/inference-contract.js` |

---

## 🧪 Run Locally

Install dependencies:

```bash
npm install
```

Run everything:

```bash
npm run dev
```

Or run separately:

```bash
npm run dev:api
npm run dev:web
```

Build:

```bash
npm run build
```

---

## 🔗 Local URLs

| Service | URL |
|---|---|
| Web dashboard | `http://localhost:5173` |
| API health | `http://localhost:7080/api/health` |
| Dashboard summary | `http://localhost:7080/api/dashboard-summary` |
| Services | `http://localhost:7080/api/services` |
| Modules | `http://localhost:7080/api/modules` |

---

## 🎨 Frontend Direction

The current UI follows the requested visual direction:

| Design Choice | Current Implementation |
|---|---|
| Theme | Light + dark |
| Style | Swiss / high-contrast SaaS |
| Corners | Sharp / `rounded-sm` |
| Palette | Monochrome core with indigo accent |
| Layout | Bento-style dashboard |
| Navigation | Collapsible sidebar + topnav |
| Search | Cmd/Ctrl+K command palette |
| Testability | `data-testid` on interactive elements |

---

## ⏭️ Next Suggested Samarth Items

| Priority | Item |
|---|---|
| P0 | Persist service registry state |
| P0 | Add real shutdown route + lifecycle policy |
| P0 | Add config validation framework |
| P0 | Add mock source → echo module → log sink loop |
| P0 | Add automated contract conformance tests |
| P1 | Health monitoring dashboard |
| P1 | Logs / telemetry viewer |
| P1 | Settings / config editor |

---

## 📚 Canonical Docs

| File | Purpose |
|---|---|
| `PROBLEM_STATEMENT.md` | The problem, constraints, non-goals, success tests |
| `ARCHITECTURE.md` | The chosen architecture and boundaries |
| `CONTEXT.md` | Build order, tracker state, reuse inventory |
| `MEMORY.md` | Durable facts and invariants |

Read these before making major architectural changes.

