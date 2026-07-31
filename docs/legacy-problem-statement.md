# Vision Intel Platform â€” Problem Statement

**Status:** draft Â· **Owners:** Chetak (CV/AI/ML) + Samarth (web/app) Â· **Last updated:** 2026-07-25

Companion documents: [ARCHITECTURE.md](ARCHITECTURE.md) (the chosen solution) Â·
[CONTEXT.md](CONTEXT.md) (current state, build order, tracker) Â· [MEMORY.md](MEMORY.md) (durable facts).

This document states the **problem**, not the solution. It describes the situation, the forces acting
on it, the sub-problems, and the tests any solution must pass. Read it first when evaluating an
architectural proposal: if a proposal doesn't move at least one sub-problem in Â§4, it isn't buying
anything.

---

## 1. Situation

We ship five industrial QC / inspection products:

| Product | Kind | Produces |
|---|---|---|
| AI Supervisor | Vision, GPU, real-time | SOP compliance â€” coverage %, SOP step |
| Image Inspection | Vision, GPU | pass/fail, defect |
| OCR | Vision, GPU | text + confidence |
| Crowning | Non-vision metrology | J2 profile extraction |
| blockline-sequence | Vision, classical CV | position-swap / sequence verdict |

Each was built â€” or would be built â€” as a **separate standalone application**, with its own camera
handling, config loading, model loading, logging, persistence, and UI. Two existing codebases
(`blockline-sequence`, `1230-biztel-app`) already show the duplication: two independent camera-capture
implementations, two config systems, two UIs, no shared result format.

Adding a sixth product under this pattern means writing all of that a sixth time. Fixing a camera
reconnect bug means fixing it in six places. Today there is no artifact any two products share.

---

## 2. Problem statement

> Build **one platform** on which each product plugs in as an independent, crash-isolated module â€”
> such that changing the **OS, GPU stack, hardware, input source, or site** requires **configuration
> changes only**, never changes to a module's logic; and such that a two-person team can add a
> product without touching the core or any other product.

Everything below is a sub-problem of that sentence.

---

## 3. Forces

The pressures that make this hard. These are not negotiable.

- **Factory floor, not a lab.** A production line is running. Downtime is the cost function.
- **Two developers, five products.** Every hour of duplicated work is an hour not spent on a product.
  Any solution that presumes a platform team does not exist for us.
- **GPU inference is welded to its stack.** CUDA / TensorRT / driver versions are coupled by
  construction. No architecture removes that â€” the only question is how many places it touches.
- **A moving OS target.** JetPack 5.1 (dev: CUDA 11.4 / TRT 8 / Py 3.8) â†’ JetPack 6 (deploy: CUDA 12 /
  TRT 10 / Py 3.10) â†’ Windows GPU PC (CUDA 12 / TRT 10 / Py 3.11). Module code must survive all three.
- **Real time.** ~30fps. Raw pixels cannot be serialized over a socket per frame.
- **Shared, constrained hardware.** Multiple modules, one Jetson, one GPU, finite GPU memory.
- **Hardware heterogeneity.** GigE (Hikrobot), USB3, RTSP, file/synthetic â€” different sensors, lenses,
  mounting angles, and lighting per site.
- **Models trained on thin data.** AI Supervisor's X3D-S came from a small, imbalanced dataset, so it
  is sensitive to input distribution shift.
- **Site-by-site variation.** Camera IPs, PLC tags, model paths, and enabled modules differ per
  deployment â€” and deployment is done by whoever is on site.

---

## 4. Sub-problems

Each is stated as the failure that occurs if it is left unsolved.

### P1 â€” Duplication across products
No shared infrastructure exists; capture, config, logging, persistence, and UI are rewritten per
product.
**Failure:** cost scales linearly with product count, and a bug fixed in one product stays broken in
the other four.

### P2 â€” OS / GPU version churn leaking into product code
`TRT8 â†’ TRT10` is a real API change. If module code links CUDA directly, every module must be edited
for every platform move.
**Failure:** each OS migration becomes an N-module rewrite instead of one rebuild, and existing
deployments can never be upgraded.

### P3 â€” GPU contention on shared hardware
If each module loads its own engine, one Jetson ends up with multiple CUDA contexts and multiple GPU
memory pools, no shared batching, and duplicated engine load time.
**Failure:** out-of-memory during normal multi-module operation â€” the system cannot run its own
products simultaneously.

### P4 â€” Input variability invalidating trained models
Two cameras can share a pixel format yet differ in lens distortion, field of view, mounting angle,
white balance, and mm-per-pixel. A model trained on one degrades on the other.
**Failure:** every camera swap becomes a retraining project, and no result is comparable across sites.

### P5 â€” Fault propagation
Products co-resident in one process, or calling each other directly, means one crash takes the line
down.
**Failure:** an OCR bug stops AI Supervisor and stops production.

### P6 â€” No shared language between components
Without an enforced message format, every pair of components negotiates its own â€” the monolith
re-forming as a mesh of point-to-point coupling.
**Failure:** components can't be developed in parallel, swapped, or replaced, and sinks must know
which module produced a result.

### P7 â€” Operational blindness
No standard for health, runtime state, metrics, or logs means diagnosis is per-product guesswork over
SSH.
**Failure:** a degraded station is discovered by an operator noticing bad parts, not by the system.
Support cost is unbounded.

### P8 â€” Detection without response
Detecting a degraded service is not the same as recovering from one, and neither is the same as
telling a human.
**Failure:** the system knows it is broken and nobody finds out.

### P9 â€” Getting onto the station PC
A working repository is not a deployed system. Install, update, and rollback on a factory PC are
separate problems from "build a container per OS."
**Failure:** the platform runs on our desks only.

### P10 â€” Meaningless cross-source time
Frame timestamps from different cameras, results in the DB, and PLC events are only correlatable if
clocks agree.
**Failure:** history and traceability data can't be trusted; multi-camera correlation is impossible.

### P11 â€” Unverifiable contract conformance
If conformance is checked by hand, it is checked once and then drifts.
**Failure:** the one boundary the whole design rests on erodes silently.

### P12 â€” Traceability
QC and industrial contexts require knowing who triggered a capture, who overrode a verdict, and when
config changed.
**Failure:** a common customer/compliance requirement has to be retrofitted later at much higher cost.

### P13 â€” Team bandwidth and polyglot cost
The design admits Go + Python + C++ + Rust + web. That spread is powerful and is also a real
operational load â€” build tooling, debugging, onboarding â€” for two people.
**Failure:** the platform is architecturally correct and practically unmaintainable.

---

## 5. Constraints

**Fixed**
- Modules must be independently crashable without affecting each other.
- Multiple modules must consume the same frame concurrently, from a single publish.
- Module logic must be identical across all three OS targets.
- GPU/CUDA-coupled code must be confined to as few places as possible.
- Frames must not be serialized per-frame over a network socket.
- Local vs. distributed placement must be a config decision, not a code decision.
- Per-site variation must be expressible in config alone.

**Negotiable**
- Language per role (current defaults: **Rust core**, Python modules, C++/Python runtime, Tauri UI) â€”
  see P13 and [LANGUAGES.md](LANGUAGES.md).
- ~~Whether Core also owns frame transport, or only the control plane.~~ **Settled: Core owns it.**
- Vision Runtime repo shape â€” separate repo vs. in-tree.
- Whether the camera SDK is promoted behind a port.
- Deployment topology per module.

---

## 6. Non-goals

- **Not a vision-only platform.** Vision is one *kind* of module; Crowning is non-vision.
- **Not removing CUDA/TRT coupling** â€” only relocating its cost from *per-deployment-by-hand* to
  *per-OS-in-a-build*.
- **Not guaranteeing zero revalidation** on arbitrary camera swaps (see Â§8).
- **Not shipping the OS or driver stack.** That is a prerequisite of the box.
- **Not a general-purpose message broker.** The bus is dumb transport for this platform.
- **Not replacing the training workflow.** Dataset/model training is a separate pipeline from runtime
  model management.

---

## 7. Success criteria

The architecture is working if each of these is demonstrably true. Written to be *tested*, not argued.

| # | Test | Targets |
|---|---|---|
| S1 | Swap the camera model; the diff across all module code is empty â€” only config/calibration files change. | P2, P4 |
| S2 | Move a module to a second box by editing `device.yaml` only; no code change, frames cross the network. | P6 |
| S3 | `kill -9` any module process. Every other module keeps producing, the source keeps publishing, the core marks it unhealthy, restarts it, and it resumes. | P5 |
| S4 | Migrate JP5 â†’ JP6. Changes are confined to the runtime container plus one backend file; module diff is empty. | P2 |
| S5 | Run all GPU modules simultaneously on one Jetson without OOM, with the engine loaded once and shared. | P3 |
| S6 | Add a module = drop a folder + enable it in `site.yaml`. Zero core edits, zero edits to other modules. | P1, P6 |
| S7 | One frame published once reaches every subscribed module, and a slow module never blocks a fast one. | P3, P5 |
| S8 | Contract conformance is asserted by an automated test on every commit, against synthetic sources, with no hardware attached. | P11 |
| S9 | A degraded service is visible on a dashboard and reaches a human without anyone opening a terminal. | P7, P8 |
| S10 | A third person authors a working module from documentation alone, without asking Chetak or Samarth. | P1, P13 |
| S11 | Any result in history traces back to its frame, source, model version, and the person who triggered or overrode it. | P10, P12 |

---

## 8. Limits we accept up front

Stated now so they aren't discovered as failures later.

- **Normalization has an optical floor.** Format and geometry normalization make a new camera *look*
  like the old one; they cannot recover resolution the sensor never captured, or fix bad lighting. For
  a thin-dataset model, a genuinely different camera may still need a validation pass or fine-tuning
  samples. "Any camera, zero revalidation" is a direction, not a guarantee.
- **Config selects; it does not translate.** "OS change = config change" holds only because a pre-built
  platform image exists for that OS. Someone still pays that build cost once per OS.
- **The port makes versions irrelevant to callers, not identical.** It is a firewall, not a unifier.
- **Live 30fps video with overlays in a webview is unproven for us.** It is the highest-risk UI
  assumption and should be prototyped before the UI stack is committed.
- **One boundary carries the whole design.** If any module reaches into core internals, another module,
  or links CUDA directly, both the modularity *and* the OS-portability property break at once. There is
  no partial-credit failure mode here.

---

## 9. Open problems

Unresolved, and each blocks or reshapes work downstream.

1. ~~**Does Core own frame transport?**~~ **RESOLVED 2026-07-28 â€” yes, Core owns it.** Consequences:
   Core is a hot-path component, so its language is **Rust** (not Go), and the separate "hot data
   path" role is absorbed into Core. The invariant "the core never touches a frame" is restated as
   **"the core never *interprets* a frame"** â€” it owns the shared-memory pipe, not the meaning of the
   pixels in it. See [LANGUAGES.md](LANGUAGES.md) Â§1.
2. **Where does the Vision Runtime sit in the startup order?** The current sequence is
   sources â†’ sinks â†’ modules; the Runtime and its port are unplaced.
3. **Vision Runtime repo shape.** Described as "its own repo/process," drawn in-tree. Pick one.
4. **Deployment topology per module.** Principle agreed â€” real-time / hardware-bound must be on-prem,
   stateless request/response can run anywhere â€” but no concrete per-module decisions yet.
5. **Cloud delivery model.** Hosted by us with a customer link vs. shipped into the customer's
   environment. Data residency decides it, and hasn't been established.
6. **Camera SDK behind a port?** Only justified if the Windows x86 target becomes real. It already
   publishes by topic, so it can be promoted later without touching a module â€” deferrable.
7. **How narrow should the language spread be?** See P13. *Partially addressed 2026-07-28:*
   [LANGUAGES.md](LANGUAGES.md) now records the policy, and the Core-owns-transport decision **removed**
   a language by absorbing the C++/Rust hot-path role into a Rust core. Current spread: Rust (core) Â·
   Python (modules, registry, contracts) Â· C++ or Python (Vision Runtime) Â· Tauri/Rust (UI, deferred).
   Still open: whether the Vision Runtime is C++ *or* Python â€” picking Python would cut the spread again.
8. ~~**Which model-loading component actually exists?**~~ **RESOLVED 2026-07-28.** Two survive, one is
   deleted: a GPU-free **Model Registry** (catalog, versioning, compatibility, artifact selection â€”
   P0) and the Vision Runtime's **engine cache** (loading, CUDA context, sharing â€” P1).
   **Per-module model loading is deleted**, since it is exactly P3's OOM failure mode; declaring a
   model is already covered by the module manifest's `requires.models`. The registry selects the
   artifact from a config box-profile and the runtime verifies it on load. See
   [ARCHITECTURE.md](ARCHITECTURE.md) Â§5.1.
