# BiztelAI Platform — Memory

**Last updated:** 2026-07-25

Durable facts about this project: things that are true, stay true, and are expensive to re-derive. Load
this first. Everything here is either a settled invariant or an environment fact — no speculation, no
work-in-progress.

For the reasoning behind any of it: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) (why) ·
[ARCHITECTURE.md](ARCHITECTURE.md) (how) · [CONTEXT.md](CONTEXT.md) (current state, build order, tracker).

---

## Document index

| File | Holds | Read it when |
|---|---|---|
| [MEMORY.md](MEMORY.md) | This file — durable facts, invariants, environment | Always, first |
| [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) | Situation, forces, 13 sub-problems, constraints, non-goals, 11 success tests, accepted limits, open problems | Evaluating any architectural proposal |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Five roles, responsibility map, layer split, lifecycle, data flow, folder layout, contracts, normalize layer, OS portability, tech stack | Building or reviewing a component |
| [CONTEXT.md](CONTEXT.md) | Settled / exploratory / open, build order Tier 0–5, reuse inventory, pages, frameworks, tracker state + known issues | Picking up work, or onboarding |

**Canonical set = those four, at the project root.** The four drafts in [memory/](memory/) are superseded
(and one, `hehe.md`, is a byte-identical duplicate of `factory-vision-architecture.md`). Don't edit the
drafts; don't cite them.

---

## The project in one line

> **Core supervises · bus carries · sources produce (and normalize) · modules process · sinks act ·
> Vision Runtime does the GPU work for those that need it — and everyone speaks only in topics defined
> by contracts.**

A general **pluggable module platform** (not vision-only) replacing five would-be standalone apps.
**Core property:** changing OS, hardware, input source, or site = **config change only**, never a change
to a module's logic.

---

## Team

- **Chetak** — CV / AI / ML: inference, models, image processing, vision runtime, classical CV.
- **Samarth** — Web / App: UI, bus/core, sinks, integrations, config, infra frameworks.

Two people, five products. Any proposal that assumes a platform team doesn't apply here.

**Current load is skewed:** Samarth holds 61 of 95 tracked items and 25 of 40 P0s (all 22 Pages + 17 of
19 Platform Frameworks); Chetak holds 34, all CV/GPU. Factor this in before suggesting who does what.

---

## Products

| Product | Kind | Produces |
|---|---|---|
| AI Supervisor | Vision, GPU, real-time | coverage %, SOP step (SOP compliance) |
| Image Inspection | Vision, GPU | pass/fail, defect |
| OCR | Vision, GPU | text + confidence |
| Crowning | **Non-vision** metrology | J2 profile extraction |
| blockline-sequence | Vision, classical CV | position-swap / sequence verdict |

- **"Both"** in the tracker = AI Supervisor **and** Image Inspection — the two products currently
  driving platform requirements.
- **AI Supervisor is hardware-bound and real-time** → must run on-prem. **Crowning is stateless
  request/response** → could run anywhere, including cloud.
- **AI Supervisor's model is X3D-S, trained on a small, imbalanced dataset** → sensitive to input
  distribution shift. This is why camera swaps aren't automatically free.

---

## Invariants — violating any of these breaks the design

1. **Every service knows its inputs and outputs only as topics.** Never another service's identity or
   location. This single rule is what buys crash isolation, hot-swapping, and distribution.
2. **A module never contains GPU machinery — it calls the Vision Runtime.** Machinery (engine
   load/cache, TRT/ONNX exec, GPU memory, batching, generic pre/post) is Layer 1. Meaning (which model,
   when, thresholds, interpretation, bespoke postprocessing) is Layer 2. Modules that load their own
   engines produce multiple CUDA contexts on one Jetson → OOM. A module *declares* the model it needs
   via `requires.models` in its manifest; it never loads one. (This is why "model loading per module"
   was deleted — see [ARCHITECTURE.md](ARCHITECTURE.md) §5.1.)
3. **No module calls another module directly.** Ever. Everything goes over the bus.
4. **The core never *interprets* a frame.** Core owns the frame **transport** — shared-memory
   segments, slot allocation, lifetime, and fan-out (settled 2026-07-28) — but never decodes,
   inspects, or acts on pixel content. *Moving* the bytes is Core's job; *understanding* them is a
   module's. It also supervises config, registry, lifecycle, health, and the UI shell.
5. **Global contracts are the grammar; per-module contracts are the vocabulary.** Global
   (`contracts/`): frame envelope, result envelope, bus topics, service interface, module interface,
   inference contract. Per-module (`modules/<x>/contract/`): its manifest + its own result schema.
6. **Sources normalize before publishing** — format *and* geometry/calibration — so every module sees
   one canonical frame regardless of camera. Normalization is config-driven, per camera.
7. **Frames ride shared memory, never a per-frame socket serialization.** The port carries only a small
   "run model X on frame slot 7" control message. ~30fps of raw pixels over a socket is not viable.
8. **Module logic is identical on every OS target.** If an OS change requires editing a module, the
   design has been violated somewhere.
9. **The inference contract is the version firewall.** It is simultaneously the module↔runtime interface
   and the boundary that keeps CUDA/TRT churn away from product code. Guard it above all else.
10. **One boundary carries the whole design.** A module that reaches into core internals, another module,
    or links CUDA directly breaks modularity *and* OS portability at once. There is no partial failure
    mode.

---

## Platform targets

| Axis | JetPack 5.1 (dev) | JetPack 6 (deploy) | Windows GPU PC |
|---|---|---|---|
| OS | Ubuntu 20.04 (L4T 35) | Ubuntu 22.04 (L4T 36) | Windows + WSL2 / native |
| CUDA / TRT | 11.4 / TRT 8 | 12.x / TRT 10 | 12.x / TRT 10 |
| Python | 3.8 | 3.10 | 3.11 |
| torch / onnxruntime | L4T wheels (CUDA 11.4) | L4T wheels (CUDA 12) | PyPI CUDA-12 wheels |
| Camera SDK | Hikrobot ARM/L4T | Hikrobot ARM/L4T | Hikrobot x86 Windows |
| **Module code** | **identical** | **identical** | **identical** |

**Cost of an OS switch, three tiers:** T1 module logic never changes · T2 environment rebuilt once per OS
in a Dockerfile (the real cost, paid once) · T3 small localized code, i.e. TRT8→TRT10 in one backend file.

The two things that cost real time on JP5→JP6: finding the JP6 wheels, and the TRT8→TRT10 API change.

---

## Default language per role

**Rust** (core/platform — supervisor *and* the shared-memory hot path, which Core owns) · C++ or Python
(Vision Runtime — the one genuinely per-platform piece) · Python (ML/vision modules) · any language
(logic modules like Crowning) · Tauri = web frontend + Rust shell (desktop UI).

Full policy, including which contract needs which binding: [LANGUAGES.md](LANGUAGES.md).

They coexist because the **bus contract is the only thing they share** — messages, never code.

**Two standing caveats:** the full polyglot spread is a real operational load for two people (lean
Python where not forced otherwise); and **live 30fps video with overlays in a webview is unproven for
us** — prototype it before committing the UI stack, or consider Qt.

---

## Accepted limits — don't rediscover these as bugs

- **Normalization has an optical floor.** It makes a new camera *look* like the old one; it cannot
  recover resolution the sensor never captured or fix bad lighting. With a thin-dataset model, a
  genuinely different camera may still need validation or fine-tuning samples. "Any camera, zero
  revalidation" is a direction, not a guarantee.
- **Config selects; it does not translate.** "OS change = config change" holds only because someone
  already built the platform image for that OS.
- **The port makes versions irrelevant to callers, not identical.** Firewall, not unifier.
- **No architecture removes CUDA/TRT coupling.** It only relocates the cost from per-deployment-by-hand
  to per-OS-in-a-build.

---

## Environment facts

- **Working dir:** `/home/biztelai/Projects/BiztelAI Platform` — **not a git repository.** No history, no
  branches, no diffs. Be careful with overwrites; there is nothing to recover from.
- **Tracker:** `BiztelAI_Module_Tracker(1).xlsx` — 2 sheets (`Module Tracker` with 95 data rows +
  header, `Legend` with 16 rows).
- **`openpyxl` is not installed** (pandas 2.0.3 is, but can't read xlsx without it). To read the
  tracker: unzip the xlsx and parse the XML directly with `xml.etree`. Note the workbook has **no
  `sharedStrings.xml`** — cell text is stored as `t="inlineStr"` inside `<is><t>`, so a parser that only
  handles shared strings will silently return empty cells.
- **`memory/` is a project folder of superseded drafts**, unrelated to any agent memory mechanism.

---

## Next action

**Write the four unblocking Tier 0 schemas:** frame envelope, result envelope, service interface, module
interface. They unblock all parallel work. Full build order: [CONTEXT.md](CONTEXT.md) §6.

- ~~**Does Core own frame transport?**~~ **Settled 2026-07-28: yes.** Core owns the shared-memory hot
  path, which makes Core **Rust** and absorbs the separate "hot data path" role. See
  [LANGUAGES.md](LANGUAGES.md) §1.
- ~~**Collapse the three overlapping model-loading items.**~~ **Settled 2026-07-28:** GPU-free **Model
  Registry** (catalog/version/compatibility/artifact selection, P0, Python) + Vision Runtime **engine
  cache** (loading/CUDA/sharing, P1). **Per-module model loading deleted.** Registry selects from a
  config box-profile; the runtime verifies against its linked TensorRT. See
  [ARCHITECTURE.md](ARCHITECTURE.md) §5.1.
