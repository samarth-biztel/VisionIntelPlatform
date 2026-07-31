# Roadmap

## Current P0 Status

| Item | Status | Notes |
|---|---:|---|
| Manifest spec with needs/provides | Done | JS, Python, and Rust bindings updated |
| Publish/subscribe bus | Done | Rust in-memory topic bus with wildcards |
| Service registration | Done | Contract-shaped registry in the Rust Core |
| Heartbeat / alive-check | Done | Fresh/stale/alive state exposed to dashboard |
| Startup/shutdown sequencing | Done | Ordered plans plus executable startup/shutdown endpoints |
| Config loading (device.yaml / site.yaml) | Done | YAML preferred, JSON/default fallback |
| Dependency checking | Done | Services, enabled modules, roles, topics, and config keys checked |
| Backend/frontend split | Done | Rust backend and React frontend app folders |
| Rust contract binding | Done | Shared fixture conformance covers the Rust binding |
| Node backend removal | Done | Old Node API/runtime files removed after Rust build passed |
| Documentation structure | Done | Root README + topic docs updated |

## Next Recommended Milestones

| Priority | Work | Why |
|---|---|---|
| P1 | Add persistent database | Keep registry/results/dependency snapshots after restart |
| P1 | Harden Rust Core transport | Move beyond the in-memory seed bus when real multi-process/device transport lands |
| P1 | Add authentication | Protect operator controls and service APIs |
| P1 | Add audit log | Track lifecycle actions, shutdowns, and operator changes |
| P1 | Add module CRUD UI | Register/edit/disable modules from dashboard |
| P2 | Add Tauri shell | Wrap the existing React frontend in the deferred desktop UI shell |
| P2 | Add camera source adapters | Connect real vision inputs |
| P2 | Add result history UI | Inspect results by frame/module/time |
| P2 | Add dependency detail UI | Drill into failed checks and remediation guidance |
| P2 | Add CI checks | Build backend/frontend/contracts automatically |

## Production Hardening Checklist

| Area | Checklist |
|---|---|
| API | Auth, rate limits, input size limits, structured logs |
| Config | Environment-specific config validation and deployment review |
| Bus | Production transport path, external broker where distributed deployment needs it, retries, dead-letter path |
| Registry | Database persistence, stale-service alerts |
| Lifecycle | Audit logs, authorization, dry-run mode, rollback/retry policy |
| Dependencies | Persist snapshots, alert on failed required checks |
| Frontend | Error states, loading skeletons, role-based actions |
| Deployment | Environment variables, preview/prod separation |
| Observability | Metrics, traces, heartbeat history |

## Design Direction

Keep the dashboard operational and compact:

- Dense but readable tables
- Clear status indicators
- Icon buttons for simple controls
- No decorative clutter
- Fast scanning for operators