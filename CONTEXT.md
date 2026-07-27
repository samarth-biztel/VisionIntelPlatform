# BiztelAI Platform — Context & Current State

**Last updated:** 2026-07-25 · **Team:** Chetak (CV/AI/ML) + Samarth (web/app)

Companion documents: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) (why) ·
[ARCHITECTURE.md](ARCHITECTURE.md) (how) · [MEMORY.md](MEMORY.md) (durable facts).

This is the working-state file: what's **settled**, what's **exploratory**, what's **open**, what the
build order is, what can be reused, and where the tracker actually stands. Paste this at the start of a
new conversation to bring anyone (or any agent) up to speed without re-explaining the project.

---

## 1. What this is

A general **pluggable module platform** — not vision-only. Instead of building each product as a
separate standalone app, we build one platform with shared infrastructure, and each product plugs in as
a **module**. Vision is one *kind* of module; the Vision Runtime is one *optional* platform service that
only GPU modules use.

**Core property:** changing the OS, hardware, input source, or site should require **config changes
only**, never changes to a module's logic.

**Current state:** designed, essentially unbuilt. 68 of 95 tracked items are greenfield; only 7 are
reusable as-is. No code has been written against the contracts yet.

---

## 2. The products

| Product | Kind | Produces | Notes |
|---|---|---|---|
| **AI Supervisor** | Vision, GPU, real-time | coverage %, SOP step | SOP-compliance system. X3D-S model, trained on a small imbalanced dataset. Hardware-bound → must be on-prem. |
| **Image Inspection** | Vision, GPU | pass/fail, defect | Second of the two current products. |
| **OCR** | Vision, GPU | text + confidence | P2 — later. |
| **Crowning** | Non-vision metrology | J2 profile extraction | Stateless request/response → could run anywhere, including cloud. |
| **blockline-sequence** | Vision, classical CV | position-swap / sequence verdict | Existing QC app with HMI-style UI, running on mock/simulated state. The **first real port**, and the main source of reusable code. |

"Both" in the tracker means AI Supervisor **and** Image Inspection — the two products currently driving
platform requirements.

---

## 3. Settled decisions

Do not re-litigate these without a reason that touches
[PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) §4.

**Shape**
- **Five roles:** Core (control plane) · Source services (produce + normalize) · Module services
  (products) · Sink services (act on results) · Vision Runtime (shared GPU machinery, optional).
- **Hybrid communication:** core for control/lifecycle, a **bus** (pub/sub by topic) for data.
- Every service knows only its **input/output topics** — never another service's identity or location.
  This one rule gives crash isolation, hot-swapping, and distribution for free.
- Modules run as **crash-isolated separate services**; multiple run simultaneously.

**Boundaries**
- **Contracts at two levels:** global (frame/result envelopes, bus topics, service + module interfaces,
  inference contract) vs. per-module (each module's own manifest + result schema).
- **Vision Runtime = machinery** (engine load/cache, TRT/ONNX exec, GPU memory, batching, generic
  pre/post). **Module = meaning** (which model, when, thresholds, interpretation, bespoke
  postprocessing). A module is a *client* of the Runtime, never a copy of it.
- **Data standardization** lives in the source service's `normalize` stage (format + calibrate), driven
  by per-input config — so changing the camera doesn't change any module.

**Portability**
- Target path: **JetPack 5.1 (dev) → JetPack 6 (deploy) → Windows GPU PC**.
- Three bands: product code (identical everywhere) / platform layer (built once per OS) / OS+driver
  stack (a prerequisite).
- Cost tiers: **T1** module logic never changes · **T2** environment rebuilt once per OS in a
  Dockerfile · **T3** small localized code (TRT8→TRT10 in one backend file).
- **Standardize what you own, isolate what you don't:** confine CUDA/TRT to one port-speaking service;
  the port + inference contract act as a **version firewall**. Frames move via **shared memory**, not
  serialized over a socket.

**Stack**
Go (core/platform) · C++ or Python (Vision Runtime) · Python (ML/vision modules) · any language (logic
modules like Crowning) · Rust or C++ (hot data paths) · Tauri (desktop UI).

---

## 4. Exploratory — discussed, not decided

- **Deployment topology** (on-prem vs. GCP vs. semi-hybrid, per module). *Principle* established:
  real-time and hardware-bound modules (AI Supervisor) must be on-prem; stateless request/response
  modules (Crowning) can run anywhere, including "code on GCP, hand over a link." Not yet turned into
  concrete per-module decisions.
- **Online delivery model:** "hosted in our cloud, give the customer a link" vs. "shipped into the
  customer's own environment" (data residency). Unresolved.
- **Core scope:** pure control plane (→ Go, clearly right) vs. also owning the shared-memory frame
  transport (→ leans Rust). This is the one branch point that could tip the core's language.
- **Polyglot cost:** the full Go + Python + C++ + Rust + web spread is powerful but heavy for two
  people. Consciously narrowing (lean Python where not forced otherwise) is worth considering.

---

## 5. Open architectural decisions

1. **Vision Runtime repo shape** — separate repo vs. a folder in the monorepo. (Currently drawn in-tree
   but described as "its own repo/process" — a mild contradiction to resolve.)
2. **Startup sequence** — where the Vision Runtime and its port fit in the core's start/registration
   order. The documented order is sources → sinks → modules only.
3. **Camera SDK isolation** — put the camera behind a port only if/when the Windows x86 target becomes
   real. It already publishes by topic, so it can be promoted later without touching any module.

Full list, including the ones that block work: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) §9.

---

## 6. Build order

### Tier 0 — Contracts (schemas only, no code) ← **start here**
1. Frame envelope schema (frame id, timestamp, source topic, format, dimensions, calibration, payload ref)
2. Result envelope schema (frame id, module id, verdict, payload, confidence, latency, error)
3. Bus topic naming convention (`camera.*`, `result.*`, `control.*`, `event.*`)
4. Service interface (register / heartbeat / shutdown / health)
5. Module interface (init(config) / on_frame / publish / teardown)
6. Manifest spec (what a module declares it needs/provides)
7. Inference contract (request/response for model calls)

**Write these four first, literally:** frame envelope, result envelope, service interface, module
interface. They unblock everyone else to work in parallel.

### Tier 1 — Skeleton loop (proves contracts hold; no real hardware or models)
Bus (in-memory pub/sub) → Core (minimal boot) → Mock source (fake frames) → Echo module (canned result)
→ Log sink (prints results) → Config loader.
**Goal:** frames flow mock source → echo module → log sink correctly. That single test proves the role
split works before touching real camera or model code.

### Tier 2 — Real I/O
GigE source · OpenCV/USB source (reuse from blockline-sequence) · normalize stage · PLC sink ·
storage/history sink · per-OS Dockerfile.

### Tier 3 — Vision Runtime
Backend abstraction (trt/onnx/torch) · engine cache · GPU memory pool · batching scheduler · generic
pre/post processing · port layer (version firewall).

### Tier 4 — Modules
blockline-sequence (first real port) · AI Supervisor · Image Inspection · OCR · Crowning.

### Tier 5 — UI
Tauri shell + Rust bridge to Go core · shared design tokens · reusable components (StatusBadge,
CaptureCommandBar) · module UI panel slot.

---

## 7. Reuse inventory

**Source repos:** `blockline-sequence` (existing QC app — HMI-style UI, HistoryPage, PlcPage, running on
mock/simulated state) · `1230-biztel-app` (has real GigE camera reconnect logic).

**Lift as-is**
- design-tokens (Tailwind theme + CSS custom props)
- ui-components / HMI symbols (pure SVG ladder symbols, pilot lamps, props-only)
- frame-capture-opencv (webcam/video/still-image capture, hardware-free in still mode)
- detection-result-schema (fractional-bbox detection contract, end-to-end Python→browser)
- StatusBadge, CaptureCommandBar layout
- mock/sample frame generation

**Lift after decoupling**
- image-preprocessing (grayscale→BGR + resize normalize — cut out of its ABC into a free function)
- inference-runtime classical CV (blob-detect by area/aspect, hole counting — drop the config import,
  generic terms)
- detection-overlay-rendering (fraction→pixel math + alpha-blend overlay — cut domain status colours)
- sequence-comparison (pairwise position-swap detection — return pairs instead of mutating in place)
- ui-components app shell (sidebar + clock + role picker — delete the fake client-side auth first)
- image-pan-zoom (wheel zoom, drag, focus-on-box — extract as a hook, discard the component)

**Rewrite — concept reusable, code isn't**
- frame-capture-gige (take the reconnect model from the station app)
- config-loading (keep the typed-dataclass-per-section pattern, drop hand-written hydration)
- model-loading · data-persistence · frame-capture-synthetic · HTTP glue (the seam the bus replaces
  wholesale) · logging-telemetry — all effectively build-from-scratch.

---

## 8. Pages to build

- **Core / shell:** Dashboard, Login/Auth, Settings (config editor), Service Registry view
- **Source / capture:** Live Camera Feed, Manual Capture/Trigger, Camera Calibration
- **Module panels** (one per module, same shell pattern): AI Supervisor, Image Inspection, OCR,
  Crowning, blockline-sequence
- **History / results:** History, Result Detail, Export/Report
- **Sink / integration:** PLC Status, Storage/DB Status
- **Monitoring / diagnostics:** Health Monitoring dashboard, Logs/Telemetry viewer, Error/Alert
- **Admin:** Module Manager, User Management

---

## 9. Platform frameworks

**P0 — core infra, needed by both AI Supervisor and Image Inspection**
Configuration Framework · Configuration Validation · Configuration Versioning · Event Framework ·
Runtime State Framework (Starting/Running/Degraded/Error/Stopped) · Module Context API · Model
Management (lightweight) · Structured Logging Framework · Metrics Framework · Health Monitoring
Framework.

**Added from gap analysis**
| Item | Priority | Owner | Why |
|---|---|---|---|
| Testing Framework (unit + integration + mock-hardware harness) | P0 | Samarth | Otherwise contract conformance is a manual check forever |
| CI/CD Pipeline | P0 | Samarth | Makes the mock/synthetic sources actually useful — run on every commit |
| Deployment / Installer Packaging | P0 | Samarth | Distinct from per-OS Dockerfiles — this is how it physically reaches the factory floor |
| Time Sync (NTP / clock discipline) | P0 | Samarth | Frame timestamps are meaningless across sources if clocks drift |
| Watchdog / Auto-Recovery | P0 | Samarth | Closes the gap between detecting a bad state and responding to it |
| Audit Trail / Traceability | P1 | Samarth | Common QC/industrial compliance need — cheaper now than retrofitted |
| Alerting / Notification | P1 | Samarth | Health Monitoring detects; this decides who gets told and how |
| Dataset / Model Training Pipeline | P2 | Chetak | Distinct from runtime Model Management |
| Documentation Framework | P2 | Samarth | Lets a third person build a module without asking Chetak or Samarth |

---

## 10. The tracker

**File:** `BiztelAI_Module_Tracker(1).xlsx` · 2 sheets (`Module Tracker`, `Legend`) · **95 data rows**.
Columns: **Module/Page · Category · Commonality · Status · Developed By · Priority · Description ·
Why Needed Now**.

### What every column means

| Column | What it answers | Filled in? |
|---|---|---|
| **Module / Page** | The name of the thing being built — one deliverable per row | all 95 rows |
| **Category** | Which architectural layer or role it belongs to | all 95 rows |
| **Commonality** | Who uses it — shared infrastructure, or one specific product | all 95 rows |
| **Status** | Whether code for it already exists, and in what shape | all 95 rows |
| **Developed By** | Which of the two developers owns it | all 95 rows |
| **Priority** | When it has to exist relative to everything else | all 95 rows |
| **Description** | What the item actually is, in one sentence | **19 of 95** — Platform Frameworks only |
| **Why Needed Now** | The justification for its priority — what breaks without it | **19 of 95** — Platform Frameworks only |

The `Legend` sheet defines the values for four columns: Status, Developed By, Commonality, and Priority.
Definitions quoted below in *italics* are the Legend's own wording, verbatim. **Category is not defined
anywhere in the workbook** — those definitions are derived from
[ARCHITECTURE.md](ARCHITECTURE.md) §3 and §8.

---

### `Category` — which architectural layer it belongs to

Not in the Legend sheet. Maps directly onto the five roles plus three support layers.

| Value | Meaning | Rows |
|---|---|---|
| **Contracts** | The global shared language — envelopes, topic naming, interfaces, the inference contract. Schemas, not code. | 7 |
| **Bus / Core** | The control plane and the transport: pub/sub, service registration, heartbeat, startup sequencing, config loading, dependency checks. | 6 |
| **Source Services** | The input side — capture → normalize → publish. Cameras, mock/synthetic frames, calibration, timestamping. | 7 |
| **Module Services** | The products themselves and the module-side machinery they share (frame ingestion, result generation, result publishing). | 13 |
| **Vision Runtime** | The optional Layer 1 GPU service — backends, engine cache, GPU memory, batching, generic pre/post, the port layer. | 6 |
| **Sink Services** | The output side — PLC writer, storage/history, UI result sink, logging/telemetry. | 4 |
| **Shared UI Components** | Reusable front-end pieces: design tokens, HMI symbols, app shell, StatusBadge, pan-zoom hook, the Tauri shell. | 7 |
| **Pages** | Individual screens in the operator/admin UI. | 22 |
| **Platform Frameworks** | Cross-service infrastructure every module depends on: config, events, runtime state, logging, metrics, health, testing, CI/CD, deployment, time sync, watchdog, audit, alerting. | 19 |
| **Cross-cutting** | Concerns with no single home — error handling, retry/reconnect, schema validation, the HTTP glue being retired. | 4 |

---

### `Commonality` — who uses it

| Value | Legend definition | Rows |
|---|---|---|
| **Platform-wide** | *"Shared infrastructure - not tied to any single module/product"* | 59 |
| **Both** | *"Used by both AI Supervisor AND Image Inspection specifically (the two current products)"* | 19 |
| **A specific project name** | *"Only relevant to that one module/page (e.g. blockline-sequence, OCR)"* | 17 (12 pure + 5 compound) |

The project-name values actually in use: `blockline-sequence` (4) · `AI Supervisor` (2) ·
`Image Inspection` (2) · `OCR` (2) · `Crowning` (2) — 12 rows.

**Undocumented convention:** the remaining 5 use a **compound form** — `Platform-wide / blockline-sequence`
(4 rows) and `Platform-wide / 1230-biztel-app` (1 row). The Legend doesn't mention this. It reads as
*"belongs to the platform, but the existing code to start from lives in that repo"* — i.e. it's marking
provenance, not ownership. Worth either formalising or splitting into a separate "Source repo" column.

> ⚠️ **This column currently carries no information beyond Category.** All 19 `Both` rows are Platform
> Frameworks and all 19 Platform Frameworks rows are `Both` — a perfect overlap — even though
> Configuration Framework, Structured Logging, and Metrics are plainly platform-wide shared infra rather
> than two-product-specific. See §11.1.

---

### `Status` — does code for this already exist

| Value | Legend definition | What it means in practice | Rows | Colour |
|---|---|---|---|---|
| **To be developed** | *"Nothing exists yet, build from scratch"* | Greenfield. No prior art to consult. | 68 | red |
| **Tweak existing** | *"Existing code needs decoupling / renaming / partial rework"* | The logic is right; the coupling isn't. Cut it out of its current home and generalise the names. | 12 | yellow |
| **Rewrite** | *"Existing approach doesn't fit the platform, rebuild fresh"* | Keep the *concept*, discard the *code*. | 8 | orange |
| **Lift as-is** | *"Can be reused directly with no changes"* | Copy it over and move on. | 7 | green |

`Tweak existing` + `Rewrite` + `Lift as-is` = 27 rows with something to start from; `To be developed` =
68 rows from zero. The per-item detail of what to lift, decouple, or rewrite is in §7.

---

### `Developed By` — who owns it

| Value | Legend definition | Rows | Colour |
|---|---|---|---|
| **Chetak** | *"CV / AI / ML — inference, models, image processing, vision runtime"* | 34 | blue |
| **Samarth** | *"Web / App — UI, bus/core, sinks, integrations, config"* | 61 | pink |

Read this as *drafting assignment*, not exclusive ownership — particularly for the Contracts rows, which
the design explicitly treats as owned by nobody and obeyed by everyone. See §11.6.

---

### `Priority` — when it has to exist

| Value | Legend definition | What it means in practice | Rows | Colour |
|---|---|---|---|---|
| **P0** | *"Must-have before other module work can build on it safely"* | A blocker. Building product code before this lands means rework. | 40 | red |
| **P1** | *"Important, needed soon after P0 items land"* | Needed for a real deployment, but not blocking parallel work. | 38 | yellow |
| **P2** | *"Useful, but can wait until core platform is stable"* | Deferrable without cost. | 17 | green |

Priority is about **dependency order**, not importance or effort — a P2 item can still be essential to
ship, it just doesn't block anything. Note that priority alone doesn't fully order the work: several
Vision Runtime items are P1 while the P1 modules that depend on them are also P1. See §11.3.

### Where it stands

Per-column counts are in the tables above. The cross-cut those tables can't show — **who owns what, and
when it's due**:

| Owner | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| **Chetak** | 15 | 16 | 3 | **34** |
| **Samarth** | 25 | 22 | 14 | **61** |
| Total | 40 | 38 | 17 | **95** |

Three things this makes visible:

- **68 of 95 rows are greenfield.** The platform is essentially unbuilt; only 7 items can be reused
  without changes.
- **Samarth holds 61 rows and 25 of the 40 P0s** — all 22 Pages plus 17 of the 19 Platform Frameworks.
  Chetak's 34 are the CV/GPU stack. See §11.5.
- **The 7 Contracts rows are all P0** and all in the "nothing exists yet" state — which is why §13 says
  to start there.

---

## 11. Known issues in the tracker

Found by reading the sheet against the design docs. None are blocking, all are worth fixing before the
sheet is used to assign work.

1. **`Commonality` isn't carrying information.** All 19 `Both` rows are Platform Frameworks, and all 19
   Platform Frameworks rows are `Both` — a perfect overlap. But Configuration Framework, Structured
   Logging, and Metrics are plainly platform-wide shared infra, not two-product-specific. The column is
   duplicating Category rather than distinguishing anything.

2. **Three overlapping model-loading items.** "Model Management (Lightweight)" (Platform Frameworks, P0,
   Chetak), "Model loading (per module)" (Module Services, P1, Chetak, Rewrite), and "Engine cache"
   (Vision Runtime, P1, Chetak) — while [ARCHITECTURE.md](ARCHITECTURE.md) §5 assigns engine load/cache
   unambiguously to Layer 1. Decide which of the three exists before building any of them.

3. **A P1-depends-on-P1 ordering risk.** All 6 Vision Runtime rows are P1, and AI Supervisor /
   Image Inspection module logic are also P1 — but those modules *call* the Runtime for all GPU work.
   Same priority tier for a hard dependency leaves the ordering inside P1 undefined.

4. **Rows the docs imply but the sheet doesn't have:**
   - **Per-OS Docker images** (`Dockerfile.jp5` / `.jp6` / Windows profile). "Deployment / Installer
     Packaging" explicitly says it is *distinct* from these, so the Tier 2 build work has no row.
   - **Shared-memory frame transport** — called out as the hot data path *and* the decision that could
     change Core's language.
   - **Echo module** from the Tier 1 skeleton loop.
   - **`blockline-sequence` module logic** — every other module has a logic row, and the docs call this
     one the first real port.

5. **Workload skew.** Samarth holds 61 of 95 rows and 25 of 40 P0s — all 22 Pages plus 17 of 19 Platform
   Frameworks. Chetak's 34 are CV/GPU. Worth a rebalance, or at least an explicit acknowledgement.

6. **Contracts are individually assigned to owners**, which sits oddly against the design's "global
   contracts: nobody owns, everyone obeys." The split is 4 to Chetak (frame envelope, result envelope,
   module interface, inference contract) and 3 to Samarth (bus topic naming, service interface, manifest
   spec) — meaning 3 of the 4 "write these first" schemas land on Chetak, who also owns the entire CV/GPU
   stack. Fine as a drafting assignment; should not become ownership, and the sequencing is worth a look.

Also: **only the 19 Platform Frameworks rows have Description / Why Needed Now filled in.** The other 76
rows are blank in both columns.

---

## 12. Document provenance

These four root-level docs — [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md),
[ARCHITECTURE.md](ARCHITECTURE.md), this file, and [MEMORY.md](MEMORY.md) — are the canonical set. They
consolidate four earlier drafts in [memory/](memory/), which are **superseded** and kept only for
history:

| Superseded draft | Folded into |
|---|---|
| `memory/factory-vision-architecture.md` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| `memory/hehe.md` | — byte-identical duplicate of the above |
| `memory/BiztelAI_Platform_Context.md` | this file (§6–§10) |
| `memory/biztelai-platform-context.md` | this file (§3–§5) |

Note that the two old context files differ only by filename case; they coexist on Linux but would
collide on Windows or macOS. Deleting the `memory/` drafts is safe once these four are trusted — that
cleanup hasn't been done.

---

## 13. Immediate next action

**Write the four unblocking Tier 0 schemas** — frame envelope, result envelope, service interface,
module interface — as plain schema files. Everything else can be built in parallel against them once
they exist.

Before or alongside that, two cheap decisions with outsized downstream effect:
- Settle **whether Core owns frame transport** (§4) — it determines Core's language.
- Collapse the **three model-loading items** into one (§11.2) — it determines who builds what in Tier 3.
