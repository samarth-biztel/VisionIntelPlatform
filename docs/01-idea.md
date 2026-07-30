# 💡 Idea

## What We Are Building

BiztelAI Vision Intel Platform is a modular computer-vision operations platform. It is designed to run multiple inspection, inference, metrology, and logic modules over shared camera streams without every module needing to know about every other service.

The core idea is simple:

> Cameras publish frames. Modules subscribe by topic. Modules publish results. Operators see health and flow from one dashboard.

## Product Goal

| Goal | Meaning |
|---|---|
| Modular AI inspection | Add or remove inspection modules without rewriting the whole platform |
| Shared contracts | Every service agrees on envelopes, topics, manifests, and heartbeats |
| Operator visibility | Show what is running, what is stale, and what is blocked |
| Deployment simplicity | Keep frontend and backend independently deployable |
| Future hardware readiness | Leave room for cameras, PLCs, storage, and GPU inference runtimes |

## Target Users

| User | Needs |
|---|---|
| Plant operator | See whether the platform is alive and healthy |
| Vision engineer | Register modules, inspect topics, validate envelopes |
| Backend engineer | Extend services without breaking contracts |
| Deployment owner | Ship frontend/backend independently to Vercel or another host |

## Current Experience

The frontend dashboard shows:

- ✅ Service count and health
- ✅ Module readiness
- ✅ Bus retained messages
- ✅ Startup/shutdown order
- ✅ Registry view
- ✅ Health view
- ✅ Settings/config view

## Long-Term Product Direction

The platform can grow into:

| Future Area | Direction |
|---|---|
| Real cameras | Replace mock source with GigE/RTSP/shared-memory frame publishers |
| AI runtime | Add model-serving service for TensorRT/ONNX/OpenVINO-style inference |
| Persistent registry | Store services, modules, heartbeats, and runs in a database |
| Operator actions | Start/stop modules, trigger captures, acknowledge alerts |
| Multi-site support | Manage multiple plants, lines, devices, and camera groups |



