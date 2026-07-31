# Backend

The backend is now the Rust platform core. It owns the API surface, in-memory bus, service registry snapshot, lifecycle endpoints, config loading, dependency summary, and seed mock source/echo/log flow.

The JavaScript code left under `packages/contracts/bindings/javascript/` is a contract binding for JavaScript consumers, not the backend runtime.

## Contents

| Path | Purpose |
|---|---|
| `src/main.rs` | Rust core API, registry state, bus snapshot, lifecycle handling, mock capture flow |
| `.cargo/config.toml` | Backend-local Cargo target/linker config for the GNU Rust toolchain |
| `scripts/cargo-gnu.ps1` | Adds Rust's bundled GNU tools to PATH before running Cargo |
| `Cargo.toml` | Rust backend package |
| `packages/contracts/` | Shared contract fixtures and JavaScript/Python/Rust bindings |
| `config/` | Device and site config, preferring YAML |

## Commands

```bash
npm install
npm run dev
npm run test
npm run build
```

`npm run dev` starts the Rust API on:

```text
http://localhost:7080
```

## Build Path

`npm run build` runs:

- JavaScript contract smoke/conformance checks
- Python contract conformance checks
- Rust backend tests
- Rust API startup check with `--check`

## Key API Routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Core health probe |
| `GET /api/config` | Current config and source files |
| `GET /api/dashboard-summary` | Frontend dashboard payload |
| `GET /api/dependencies` | Platform dependency report |
| `GET /api/lifecycle/startup-plan` | Ordered startup plan |
| `POST /api/lifecycle/startup` | Execute ordered startup |
| `GET /api/lifecycle/shutdown-plan` | Ordered shutdown plan |
| `POST /api/lifecycle/shutdown` | Execute ordered shutdown |
| `POST /api/source/capture` | Trigger mock frame capture |
| `GET /api/bus` | Bus snapshot |

More details: [Backend docs](../docs/06-backend.md)