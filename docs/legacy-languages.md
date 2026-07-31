# Vision Intel Platform â€” Language Policy

**Status:** binding Â· **Last updated:** 2026-07-28

Companion documents: [ARCHITECTURE.md](ARCHITECTURE.md) (Â§14 is the source of this table) Â·
[PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) Â· [CONTEXT.md](CONTEXT.md) Â· [MEMORY.md](MEMORY.md).

**The rule:** before any item is built, its language is decided from the table below and written down.
No item starts in "whatever was easiest to reach for."

---

## 1. Language per role

| Role | Language | Why |
|---|---|---|
| **Core / platform (supervisor + frame transport)** | **Rust** | Core owns the shared-memory hot path (decided 2026-07-28), so it must be a systems language. Rust gives that plus memory safety on the one component every service depends on, and cross-compiles to Ubuntu, Windows, and Jetson ARM. |
| **Vision Runtime (GPU inference)** | **C++ or Python** | Bound to CUDA / TensorRT |
| **ML / vision modules** (AI Supervisor, Image Inspection, OCR) | **Python** | ML ecosystem lives here; calls the Vision Runtime for the heavy work |
| **Logic / QC modules** (e.g. Crowning) | **Any** | Python to build fast, or Go/Rust if the module needs to be light |
| **Desktop UI** | **Tauri** (web frontend + Rust shell) | Native window (no browser), light, cross-platform; talks to the core over the bus |

They coexist because the **bus contract is the only thing they share** â€” components exchange messages,
never code.

### Why Core is Rust, not Go

**Settled 2026-07-28: Core owns frame transport.** That closes
[PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) Â§9.1, and it decides the language.

A pure control plane would be Go â€” that was never in doubt. But a core that owns the shared-memory
frame path is a hot-path component at ~30fps, and the previous table already assigned that path to
**C++ or Rust**. Splitting Core across two languages (Go supervisor + Rust transport) would be worse
than picking one.

Picking Rust for the whole core **reduces** the language count rather than raising it: the separate
"hot data path" row is now absorbed into Core. Net spread goes from *Go + C++/Rust + Python + Tauri*
to *Rust + Python + C++ + Tauri*. That is a direct win against **P13** (polyglot cost for a
two-person team).

### Component decisions

Roles set the default; individual components record their actual choice here as they are decided.

| Component | Language | Decided | Why |
|---|---|---|---|
| Contracts â€” Chetak's four | **Python** (+ JS binding) | 2026-07-28 | Real consumers are ML modules and the Vision Runtime |
| **Model Registry** | **Python** | 2026-07-28 | GPU-free, Chetak-owned, and its primary caller is the Vision Runtime. Its **catalog file is language-neutral JSON**, so a Rust core can read the same catalog later without sharing code â€” data, not a library, crosses that boundary. |
| Engine cache | **C++ or Python** | â€” | Follows the Vision Runtime; bound to CUDA/TRT |

---

## 2. What language are the contracts?

Contracts are the one thing that is **not** owned by a single role, so they are not a single language.
A contract is a *schema*; each consuming role gets a **binding** in its own language, and all bindings
must accept and reject exactly the same messages.

| Contract | Owner | Consumed by | Bindings needed |
|---|---|---|---|
| Frame envelope | Chetak | sources, ML modules, Vision Runtime, **core transport** | **Python** âœ… Â· JS âœ… Â· Rust â³ |
| Result envelope | Chetak | ML modules, sinks, UI | **Python** âœ… Â· JS âœ… Â· Rust â³ |
| Module interface / manifest | Chetak Â· Samarth | ML modules, core | **Python** âœ… Â· JS âœ… Â· Rust â³ |
| Inference contract | Chetak | ML modules â†” Vision Runtime | **Python** âœ… Â· JS âœ… Â· C++ â³ |
| Bus topic naming | Samarth | everyone | Python âœ… Â· JS âœ… Â· Rust â³ |
| Service interface | Samarth | everyone | JS âœ… Â· Python â³ Â· Rust â³ |

**Python is the priority binding for Chetak's four**, because their real consumers â€” AI Supervisor,
Image Inspection, and the Vision Runtime â€” are Python. The JS binding exists because the Core API and
operator UI are currently JavaScript (see Â§4).

**Bindings are kept honest by shared fixtures, not by review.** `packages/contracts/fixtures/*.json`
holds valid and invalid messages; every binding runs the same corpus and must agree case for case. A
binding that drifts fails its build. This is success test **S8** in
[PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) Â§7.

### Layout: no binding is primary

```
packages/contracts/
  fixtures/conformance.json   the shared truth â€” language-neutral
  bindings/
    javascript/               Zod        (core API, operator UI)
    python/                   Pydantic   (ML modules, Vision Runtime)
    rust/                     (when Core is ported)
```

Each binding sits under `bindings/<language>/`, symmetrically. **No language gets `src/`** â€” that
would imply one binding is the real one and the rest are ports, which is exactly what this design
rejects. `fixtures/` sits above them all because it outranks every binding: when a binding and the
corpus disagree, the corpus is right.

The nesting inside `bindings/python/biztel_contracts/` is Python's own packaging requirement (the
importable package directory must sit beside `pyproject.toml`), not an extra layer of ours.

---

## 3. Python version floor

Python code targets **3.8** â€” the JetPack 5.1 dev box â€” and must run unchanged on JetPack 6 (3.10) and
Windows (3.11).

Concretely, in any Python we write:

- `Optional[X]` / `Union[X, Y]`, **never** `X | Y` (PEP 604 is 3.10+)
- `List[str]` / `Dict[str, Any]` from `typing`, **never** builtin `list[str]` (3.9+)
- no `match` statements, no walrus-in-comprehension cleverness

This is the **Tier 3** cost from [ARCHITECTURE.md](ARCHITECTURE.md) Â§11: write to the lowest supported
version and the version delta disappears.

---

## 4. Current deviations â€” known and deliberate

The code in this repo does not yet match Â§1 everywhere. Recorded here so it is a **decision**, not
drift:

| Item | Policy says | Actually is | Status |
|---|---|---|---|
| Core API (`apps/api`) | **Rust** | **Node.js / Express** | Deviation â€” scaffold only. Now unblocked: the language is decided. Port when Core grows real supervision or any frame-transport logic; the JS skeleton is fine until then. |
| Bus | **Rust** (part of core) | **JS, in-process** | Deviation â€” Tier 1 skeleton. Ports with the core. |
| Operator UI (`apps/web`) | Tauri (web + Rust shell) | **Vite + React, browser only** | **Deferred by decision (2026-07-28).** The web frontend half is correct and stays; the Rust/Tauri shell is explicitly scheduled for later, not an oversight. |
| Echo module | Python (ML/vision) or Any (logic) | **JS** | âœ… Acceptable â€” `echo` is a logic/test module, and the table allows "Any" there. |
| Contracts | one binding per consuming language | **JS + Python** | âœ… Compliant. Rust binding needed when Core is ported. |

**No longer blocked.** [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) Â§9.1 is resolved: Core owns frame
transport, so Core is Rust. The remaining question is *when* to port `apps/api`, not *what to*.

**Porting order when that starts:** contracts Rust binding (held to the same
`fixtures/conformance.json`) â†’ bus â†’ registry/lifecycle â†’ shared-memory transport. The contracts
binding comes first so the JS and Rust cores can be compared against one corpus during the switch.

---

## 5. Do not take language from the tracker spreadsheet

`Vision Intel Platform_Module_Tracker(1).xlsx` / the exported CSV has `Role`, `Language`, and `Why` columns. **They
are a paste artifact and carry no per-row meaning.** Only 6 of 95 rows are filled, and those 6 are
exactly the six rows of the table in Â§1 above, pasted into adjacent columns starting at row 1. They
line up with the Contracts rows by position alone.

Read literally, the sheet claims the frame envelope schema is written in **Go**, the result envelope in
**C++ or Python**, and the module interface in **C++ or Rust** â€” none of which is true or intended.

**This file is the authority on language, not the spreadsheet.** Either clear those three columns in
the tracker or replace them with a real per-row language field derived from Â§1.
