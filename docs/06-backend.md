# Backend

## Purpose

The backend is the Rust platform core. It owns the HTTP API, runtime registration snapshot, topic messaging, health state, config loading, dependency summary, lifecycle sequencing, and the Tier 1 mock source -> echo module -> log sink loop.

## Folder Structure

```text
backend/
+-- .cargo/
|   +-- config.toml
+-- config/
|   +-- device.yaml
|   +-- site.yaml
|   +-- device.json
|   +-- site.json
+-- packages/
|   +-- contracts/
|       +-- fixtures/
|       +-- bindings/
|           +-- javascript/
|           +-- python/
|           +-- rust/
+-- scripts/
|   +-- cargo-gnu.ps1
+-- src/
|   +-- main.rs
+-- Cargo.toml
+-- package.json
```

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install the contract workspace tooling |
| `npm run dev` | Start the Rust API on port `7080` |
| `npm run test` | Run Rust backend tests |
| `npm run check` | Run Rust API startup validation |
| `npm run build` | Run JS/Python contract checks, Rust tests, and API check |

The npm scripts call `scripts/cargo-gnu.ps1`, which selects the installed GNU Rust toolchain and prepends Rust's bundled GNU tools to PATH. This avoids the missing MSVC linker/Windows SDK on this workstation.

## API Routes

| Route | Method | Purpose |
|---|---:|---|
| `/api/health` | GET | Core health probe |
| `/api/config` | GET | Current device/site config and source files |
| `/api/contracts` | GET | Contract names and canonical topics |
| `/api/dashboard-summary` | GET | Aggregated dashboard payload with dependency status and lifecycle plans |
| `/api/services` | GET | List registered seed services |
| `/api/modules` | GET | List module manifests |
| `/api/dependencies` | GET | Platform dependency report |
| `/api/lifecycle/startup-plan` | GET | Ordered startup plan |
| `/api/lifecycle/startup` | POST | Execute ordered startup |
| `/api/lifecycle/shutdown-plan` | GET | Ordered shutdown plan |
| `/api/lifecycle/shutdown` | POST | Execute ordered shutdown |
| `/api/bus` | GET | Bus snapshot |
| `/api/bus/messages` | GET | Retained messages |
| `/api/bus/subscriptions` | GET | Active subscriptions |
| `/api/bus/publish` | POST | Publish a platform event |
| `/api/source/capture` | POST | Trigger mock frame capture |
| `/api/sink/log` | GET | Read recent sink results |

## Config Loading

Config loading prefers YAML but keeps JSON/default compatibility:

```text
config/device.yaml -> config/device.yml -> config/device.json -> defaults
config/site.yaml   -> config/site.yml   -> config/site.json   -> defaults
```

## Runtime Services

| Service | Role | Publishes | Subscribes |
|---|---|---|---|
| Core Supervisor | `core` | `event.service.registered` | `health.heartbeat` |
| Mock Camera Source | `source` | `camera.line1` | none |
| Echo Module | `module` | `result.echo` | `camera.line1` |
| Log Sink | `sink` | none | `result.*` |

## Notes

- The current bus is an in-process Rust seed transport.
- The current runtime is still a Tier 1 development loop, but it is no longer Node/Express.
- JavaScript under `packages/contracts/bindings/javascript/` is only a contract binding.