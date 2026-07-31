# Architecture

## Repository Layout

```text
.
+-- README.md
+-- backend/
|   +-- .cargo/
|   |   +-- config.toml
|   +-- config/
|   |   +-- device.yaml
|   |   +-- site.yaml
|   |   +-- device.json
|   |   +-- site.json
|   +-- packages/
|   |   +-- contracts/
|   |       +-- fixtures/
|   |       +-- bindings/
|   |           +-- javascript/
|   |           +-- python/
|   |           +-- rust/
|   +-- scripts/
|   |   +-- cargo-gnu.ps1
|   +-- src/
|   |   +-- main.rs
|   +-- Cargo.toml
|   +-- package.json
+-- frontend/
|   +-- src/
|   +-- package.json
|   +-- vercel.json
+-- docs/
```

## Runtime Layers

| Layer | Responsibility | Current Files |
|---|---|---|
| Contracts | Define schemas and topic rules through symmetric language bindings and shared fixtures | `backend/packages/contracts` |
| Config | Load validated device/site runtime config | `backend/src/main.rs`, `backend/config/*.yaml` |
| Rust Core | HTTP API, publish/subscribe bus, registry, lifecycle, dependency checks | `backend/src/main.rs` |
| Source | Produces frame envelopes in the seed runtime | `backend/src/main.rs` |
| Module | Consumes frames and produces results in the seed runtime | `backend/src/main.rs` |
| Sink | Consumes result topics in the seed runtime | `backend/src/main.rs` |
| UI | Operator dashboard; web half of the later Tauri app | `frontend/src` |

## Language Policy

[legacy-languages.md](legacy-languages.md) is binding for language choices. The Core is **Rust** because Core owns both supervision and shared-memory frame transport. The current `backend/src/main.rs` implementation now matches that decision.

The operator UI is currently Vite + React in a browser. That is the correct web frontend half of the eventual Tauri desktop UI; the Rust shell is deferred.

Contracts are schemas with bindings, not a JavaScript package that other languages port from. The shared fixture corpus in `backend/packages/contracts/fixtures/conformance.json` is the authority for binding behavior.

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
                    +-- Dependency checker evaluates readiness
                          +-- Dashboard renders state
```

## Config Flow

```text
config/device.yaml + config/site.yaml
  +-- Rust Core validates shape
        +-- seed runtime receives device/site config
              +-- dashboard summary exposes loaded_from metadata
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
        +-- /api/dependencies and /api/dashboard-summary
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
| Backend Core | Long-running Rust service | Runs from `backend/src/main.rs`; serverless Node entry was removed |
| Frontend | Vercel static site now, Tauri webview later | Uses `frontend/dist` output |

The apps can be deployed separately. The frontend uses `VITE_API_BASE_URL` when the backend is on another domain.