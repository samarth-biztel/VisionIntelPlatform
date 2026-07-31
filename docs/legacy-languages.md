# Vision Intel Platform - Language Policy

**Status:** binding. **Last updated:** 2026-07-31.

Companion documents: [legacy-architecture.md](legacy-architecture.md), [legacy-problem-statement.md](legacy-problem-statement.md), [legacy-context.md](legacy-context.md), and [legacy-memory.md](legacy-memory.md).

**The rule:** before any item is built, its language is decided from the table below and written down. No item starts in "whatever was easiest to reach for."

## 1. Language Per Role

| Role | Language | Why |
|---|---|---|
| Core / platform (supervisor + frame transport) | Rust | Core owns the shared-memory hot path, so it must be a systems language. Rust gives that plus memory safety on the component every service depends on, and cross-compiles to Ubuntu, Windows, and Jetson ARM. |
| Vision Runtime (GPU inference) | C++ or Python | Bound to CUDA / TensorRT. |
| ML / vision modules (AI Supervisor, Image Inspection, OCR) | Python | The ML ecosystem lives here; calls the Vision Runtime for the heavy work. |
| Logic / QC modules (for example Crowning) | Any | Python to build fast, or Go/Rust if the module needs to be light. |
| Desktop UI | Tauri (web frontend + Rust shell) | Native window, light, cross-platform; talks to the core over the bus. |

They coexist because the bus contract is the only thing they share: components exchange messages, never code.

### Why Core Is Rust, Not Go

**Settled 2026-07-28: Core owns frame transport.** That decides the language.

A pure control plane could be Go, but a core that owns the shared-memory frame path is a hot-path component at about 30fps. Splitting Core across two languages, such as a Go supervisor plus Rust transport, would be worse than picking one.

Picking Rust for the whole core reduces the language count rather than raising it: the separate hot data path is absorbed into Core. The spread becomes Rust + Python + C++ + Tauri.

### Component Decisions

| Component | Language | Decided | Why |
|---|---|---|---|
| Core API / platform (`backend/src`) | Rust | 2026-07-31 | Implements the policy decision for supervisor, registry, bus, lifecycle, dependency checks, and future frame transport ownership. |
| Contracts - Chetak's four | Python (+ JS/Rust bindings) | 2026-07-31 | Real consumers are ML modules, the Vision Runtime, the Rust Core, and JavaScript UI/check tooling. |
| Model Registry | Python | 2026-07-28 | GPU-free, Chetak-owned, and its primary caller is the Vision Runtime. Its catalog file is language-neutral JSON, so a Rust core can read the same catalog without sharing code. |
| Engine cache | C++ or Python | Pending | Follows the Vision Runtime; bound to CUDA / TensorRT. |

## 2. Contract Bindings

Contracts are not owned by a single role, so they are not a single language. A contract is a schema; each consuming role gets a binding in its own language, and all bindings must accept and reject exactly the same messages.

| Contract | Owner | Consumed by | Bindings needed |
|---|---|---|---|
| Frame envelope | Chetak | sources, ML modules, Vision Runtime, core transport | Python done, JS done, Rust done |
| Result envelope | Chetak | ML modules, sinks, UI, core | Python done, JS done, Rust done |
| Module interface / manifest | Chetak + Samarth | ML modules, core | Python done, JS done, Rust done |
| Inference contract | Chetak | ML modules <-> Vision Runtime | Python done, JS done, Rust done, C++ pending |
| Bus topic naming | Samarth | everyone | Python done, JS done, Rust done |
| Service interface | Samarth | everyone | JS done, Python done, Rust done |

Python is the priority binding for Chetak's four because their real consumers are AI Supervisor, Image Inspection, and the Vision Runtime. The JS binding exists for JavaScript consumers and UI-facing checks. The Rust binding exists for the Core.

Bindings are kept honest by shared fixtures, not by review. `backend/packages/contracts/fixtures/conformance.json` holds valid and invalid messages; every binding runs the same corpus and must agree case for case.

### Layout: No Binding Is Primary

```text
backend/packages/contracts/
+-- fixtures/
|   +-- conformance.json
+-- bindings/
    +-- javascript/
    +-- python/
    +-- rust/
```

Each binding sits under `bindings/<language>/`, symmetrically. No language gets to be the conceptual source of truth. `fixtures/` sits above them all because it outranks every binding: when a binding and the corpus disagree, the corpus is right.

The nesting inside `bindings/python/biztel_contracts/` is Python's packaging requirement, not an extra architectural layer.

## 3. Python Version Floor

Python code targets **3.8**, the JetPack 5.1 dev box, and must run unchanged on JetPack 6 (3.10) and Windows (3.11).

In Python we write:

- `Optional[X]` / `Union[X, Y]`, never `X | Y`.
- `List[str]` / `Dict[str, Any]` from `typing`, never builtin `list[str]`.
- No `match` statements.
- No walrus-in-comprehension cleverness.

## 4. Current Deviations

The old Node.js / Express backend deviation has been removed. `backend/src` is now Rust, and the previous Node runtime/API entry files have been deleted.

| Item | Policy says | Actually is | Status |
|---|---|---|---|
| Core API (`backend/src`) | Rust | Rust | Compliant |
| Bus (`backend/src/main.rs`) | Rust, as part of Core | Rust in-process seed bus | Compliant for Tier 1; production transport still needs hardening |
| Operator UI (`frontend`) | Tauri (web frontend + Rust shell) | Vite + React, browser only | Deferred by decision. The web frontend half is correct and stays; the Rust/Tauri shell is later. |
| Echo module | Python for ML/vision, or any language for logic | Rust seed logic inside Core | Acceptable. `echo` is a logic/test module, and the table allows "Any." |
| Contracts | One binding per consuming language | JS + Python + Rust | Compliant for current consumers. C++ binding is needed when the Vision Runtime requires it. |

Core is no longer blocked on either language decision or runtime port. The remaining work is production hardening: persistence, real service process management, and the eventual shared-memory transport implementation.

## 5. Do Not Take Language From The Tracker Spreadsheet

`docs/assets/module-tracker.xlsx` has `Role`, `Language`, and `Why` columns. They are paste artifacts and carry no per-row meaning.

This file is the authority on language, not the spreadsheet. Either clear those columns in the tracker or replace them with a real per-row language field derived from this policy.