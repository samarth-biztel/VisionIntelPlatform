# 📜 Contracts

## Why Contracts Exist

Contracts make all modules and services speak the same language. A service can be written in JavaScript, Python, or another language later, but it must still follow the same schema.

## Main Contracts

| Contract | Purpose |
|---|---|
| `module-manifest.v1` | Declares what a module needs and provides |
| `service-registration.v1` | Registers a running service with the core |
| `service-heartbeat.v1` | Reports service liveness and runtime state |
| `service-shutdown.v1` | Requests controlled service shutdown |
| `frame-envelope.v1` | Carries normalized camera frame metadata |
| `result-envelope.v1` | Carries module output and traceability |

## Module Manifest

A module manifest answers two platform questions:

| Section | Meaning |
|---|---|
| `needs` | Input topics, models, config keys, and services required before startup |
| `provides` | Result topics and optional UI panel contributed by the module |

Example shape:

```json
{
  "schema_version": "module-manifest.v1",
  "module_id": "echo",
  "display_name": "Echo Module",
  "version": "0.1.0",
  "owner": "Vision Intel Platform",
  "kind": "logic",
  "needs": {
### "input_topics": ["camera.line1"],
### "models": [],
### "config_keys": ["site.enabled_modules"],
### "services": []
  },
  "provides": {
### "result_topics": ["result.echo"]
  }
}
```

`requires` is still accepted as a legacy alias, but `needs` is the preferred language.

## Dependency Checks

The backend dependency checker reads registered services, module manifests, and loaded platform config. It reports whether:

- `device.runs` services are present and running.
- `site.enabled_modules` have registered manifests.
- Manifest `needs.services` roles have running services.
- Manifest `needs.input_topics` have registered publishers.
- Manifest `needs.config_keys` exist in loaded config.

The report is exposed through `/api/dependencies` and included in `/api/dashboard-summary`.

## Topic Families

| Family | Example | Used For |
|---|---|---|
| `camera` | `camera.line1` | Frame input streams |
| `result` | `result.echo` | Module outputs |
| `health` | `health.heartbeat` | Alive checks |
| `event` | `event.service.registered`, `event.service.started` | Platform events |
| `control` | `control.shutdown` | Operator/core commands |

## Wildcard Subscriptions

The bus supports exact topics and prefix wildcard patterns:

| Pattern | Matches |
|---|---|
| `camera.line1` | Only `camera.line1` |
| `result.*` | `result.echo`, `result.ocr`, `result.ai-supervisor` |
| `event.service.*` | `event.service.registered`, `event.service.unhealthy`, `event.service.started` |

## Language Bindings

| Binding | Location | Status |
|---|---|---|
| JavaScript | `backend/packages/contracts/bindings/javascript` | Active |
| Python | `backend/packages/contracts/bindings/python` | Schema binding present |

The JavaScript contract conformance test runs in backend builds. Python verification requires a Python environment with Pydantic installed.
