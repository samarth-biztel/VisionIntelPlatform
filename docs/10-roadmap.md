# 🛣️ Roadmap

## Current P0 Status

| Item | Status | Notes |
|---|---:|---|
| Manifest spec with needs/provides | ✅ Done | JS and Python bindings updated |
| Publish/subscribe bus | ✅ Done | In-memory topic bus with wildcards |
| Service registration | ✅ Done | Contract-validated registry |
| Heartbeat / alive-check | ✅ Done | Fresh/stale/alive state exposed to dashboard |
| Startup/shutdown sequencing | ✅ Done | Ordered lifecycle plans and shutdown command |
| Backend/frontend split | ✅ Done | Two deployable app folders |
| Documentation structure | ✅ Done | Root README + topic docs |

## Next Recommended Milestones

| Priority | Work | Why |
|---|---|---|
| P1 | Add persistent database | Keep registry/results after restart |
| P1 | Replace in-memory bus for production | Support multiple processes/devices |
| P1 | Add authentication | Protect operator controls and service APIs |
| P1 | Add module CRUD UI | Register/edit/disable modules from dashboard |
| P2 | Add camera source adapters | Connect real vision inputs |
| P2 | Add result history UI | Inspect results by frame/module/time |
| P2 | Add audit log | Track operator actions and shutdowns |
| P2 | Add CI checks | Build backend/frontend/contracts automatically |

## Production Hardening Checklist

| Area | Checklist |
|---|---|
| API | Auth, rate limits, input size limits, structured logs |
| Bus | External broker, retries, dead-letter path |
| Registry | Database persistence, stale-service alerts |
| Frontend | Error states, loading skeletons, role-based actions |
| Deployment | Environment variables, preview/prod separation |
| Observability | Metrics, traces, heartbeat history |

## Design Direction

Keep the dashboard operational and compact:

- ? Dense but readable tables
- ? Clear status indicators
- ? Icon buttons for simple controls
- ? No decorative clutter
- ? Fast scanning for operators



