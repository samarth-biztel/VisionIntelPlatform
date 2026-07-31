# 🧩 Problem

## The Core Problem

Industrial vision systems often become tightly coupled:

- Camera code knows too much about AI modules.
- AI modules know too much about storage, PLCs, and each other.
- Result formats drift between teams.
- Health is hidden inside logs.
- Startup order is tribal knowledge.
- Config is hand-loaded or duplicated across services.
- Dependency failures are discovered late, after startup has already gone wrong.
- Deployment becomes difficult because UI, API, and runtime code are mixed together.

This project fixes that by creating a small platform core with contracts and runtime boundaries.

## Pain Points

| Pain | Platform Answer |
|---|---|
| Modules call each other directly | Modules communicate only through bus topics |
| Every module invents its own input/output shape | Shared frame/result envelope contracts |
| No standard module declaration | Manifest with `needs` and `provides` |
| Services start in unclear order | Lifecycle startup and shutdown sequencing |
| Config handling drifts per module/site | Core loads validated `device.yaml` and `site.yaml` |
| Dependencies are implicit | Core exposes `/api/dependencies` and dashboard summary dependency state |
| Health is hard to inspect | Heartbeat freshness and alive-check registry |
| Deployment is messy | Two deployable folders: `backend` and `frontend` |

## Why Contracts Matter

Contracts are the safety rails of the platform.

A module should not need to ask:

- What shape is a frame?
- What topic should I publish on?
- How do I report results?
- How does the core know I am alive?
- What services, topics, and config keys do I need before I can start?
- What command shape is used for controlled shutdown?

The manifest and envelope contracts answer those questions before runtime.

## Implemented Solution

| Requirement | Current Implementation |
|---|---|
| Manifest spec | `module-manifest.v1` with `needs` and `provides` |
| Pub/sub messaging | In-memory topic bus with wildcard subscriptions |
| Service registration | Contract-validated service registry |
| Heartbeat alive-check | Fresh/stale/missing heartbeat tracking |
| Startup/shutdown sequencing | Lifecycle orchestrator with ordered plans and executable endpoints |
| Config loading | Validated platform config from YAML, then JSON/default fallbacks |
| Dependency checking | Report covering configured services, enabled module manifests, service roles, topics, and config keys |
