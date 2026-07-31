# 💡 Idea

## What We Are Building

BiztelAI Vision Intel Platform is a modular computer-vision operations platform. It runs multiple inspection, inference, metrology, and logic modules over shared camera streams without every module needing to know about every other service.

The core idea is simple:

> Cameras publish frames. Modules subscribe by topic. Modules publish results. Operators see health, dependencies, lifecycle state, and flow from one dashboard.

## Product Goal

| Goal | Meaning |
|---|---|
| Modular AI inspection | Add or remove inspection modules without rewriting the whole platform |
| Shared contracts | Every service agrees on envelopes, topics, manifests, registration, heartbeats, and shutdown commands |
| Operator visibility | Show what is running, what is stale, what is stopped, and what dependencies are blocked |
| Config-driven deployment | Load device/site behavior from `device.yaml` and `site.yaml`, with JSON/default fallbacks |
| Deployment simplicity | Keep frontend and backend independently deployable |
| Future hardware readiness | Leave room for cameras, PLCs, storage, and GPU inference runtimes |

## Target Users

| User | Needs |
|---|---|
| Plant operator | See whether the platform is alive, healthy, and ready |
| Vision engineer | Register modules, inspect topics, validate envelopes, resolve dependencies |
| Backend engineer | Extend services without breaking contracts |
| Deployment owner | Configure devices/sites and ship frontend/backend independently |

## Current Experience

The frontend dashboard shows:

- ✅ Service count and health
- ✅ Module readiness
- ✅ Bus retained messages
- ✅ Startup/shutdown order
- ✅ Registry view
- ✅ Health view
- ✅ Settings/config view
- ✅ Dependency status from the backend summary payload

## Implemented P0 Core

| Area | Current Behavior |
|---|---|
| Bus | In-memory publish/subscribe transport with wildcard subscriptions |
| Contracts | Shared JavaScript/Python contract bindings and conformance fixtures |
| Registry | Service/module registration with heartbeat freshness and alive checks |
| Config | `device.yaml` / `site.yaml` loading with `.yml`, `.json`, and defaults as fallbacks |
| Dependencies | Platform report for services, enabled modules, input topics, and required config keys |
| Lifecycle | Ordered startup/shutdown plans plus executable startup/shutdown endpoints |

## Long-Term Product Direction

| Future Area | Direction |
|---|---|
| Real cameras | Replace mock source with GigE/RTSP/shared-memory frame publishers |
| AI runtime | Add model-serving service for TensorRT/ONNX/OpenVINO-style inference |
| Persistent registry | Store services, modules, heartbeats, dependency reports, and runs in a database |
| Operator actions | Start/stop modules, trigger captures, acknowledge alerts, inspect dependency failures |
| Multi-site support | Manage multiple plants, lines, devices, and camera groups |
