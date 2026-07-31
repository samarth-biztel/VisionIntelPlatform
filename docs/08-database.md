# 🗄️ Database

## Current Status

The current platform does not require a database to run.

| Data | Current Storage |
|---|---|
| Service registry | In-memory Map |
| Module registry | In-memory Map |
| Heartbeats | In-memory latest heartbeat per service |
| Bus messages | In-memory retained message list |
| Config | YAML preferred under `backend/config`, with JSON/default fallbacks |
| Dependency reports | Computed in memory from registry, manifests, and config |
| Dashboard fallback | Static JS object in frontend |

This is intentional for the P0 platform core. It keeps the first version easy to run, test, and deploy.

## Why No Database Yet?

| Reason | Benefit |
|---|---|
| Faster P0 implementation | Core behavior can be validated without schema migrations |
| Easier deployment | Backend can run as a simple Vercel API function or Node service |
| Lower coupling | Contracts and runtime behavior are designed before persistence |
| Cleaner testing | The Tier 1 loop test runs without external infrastructure |

## Future Database Needs

A database becomes useful when the platform needs persistence across restarts.

| Future Need | Suggested Table / Collection |
|---|---|
| Registered services | `services` |
| Module manifests | `modules` |
| Heartbeat history | `service_heartbeats` |
| Bus event log | `bus_messages` |
| Dependency snapshots | `dependency_checks` |
| Lifecycle actions | `lifecycle_events` |
| Captured frames | `frames` |
| Module results | `results` |
| Operator actions | `audit_log` |
| Sites and devices | `sites`, `devices` |

## Suggested Database Options

| Option | Best For |
|---|---|
| PostgreSQL | Production registry, results, audit logs, relational querying |
| SQLite | Local edge deployments and simple single-device installs |
| Redis | Fast ephemeral heartbeats, pub/sub, short retention |
| TimescaleDB | High-volume heartbeat/result time-series data |
| S3-compatible object storage | Frame images, thumbnails, evidence artifacts |

## Recommended Future Shape

```text
PostgreSQL
  +-- services
  +-- modules
  +-- service_heartbeats
  +-- dependency_checks
  +-- lifecycle_events
  +-- frames
  +-- results
  +-- audit_log

Object Storage
  +-- frame images / evidence files

Redis or NATS
  +-- live bus transport
```

## Important Design Rule

The database should not replace contracts. Contracts still define the wire format. The database should store validated contract data after it crosses the platform boundary.
