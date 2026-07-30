# BiztelAI Platform â€” Architecture

**Status:** design settled, unbuilt Â· **Owners:** Chetak (CV/AI/ML) + Samarth (web/app) Â· **Last updated:** 2026-07-25

Companion documents: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) (what this solves and how it's
tested) Â· [CONTEXT.md](CONTEXT.md) (current state, build order, tracker) Â· [MEMORY.md](MEMORY.md)
(durable facts).

One platform, many modules. Vision modules (AI Supervisor, Image Inspection, OCR) and non-vision
modules (Crowning metrology, blockline-sequence) plug in as independent services on shared
infrastructure. Changing the OS, hardware, input source, or site requires **config changes only** â€”
never changes to a module's logic.

---

## 1. Mental model

> **Core supervises Â· bus carries Â· sources produce (and normalize) Â· modules process Â· sinks act Â·
> Vision Runtime does the GPU work for those that need it â€” and everyone speaks only in topics
> defined by contracts.**

---

## 2. Design decisions

| Decision | Choice | Why it matters |
|---|---|---|
| Module execution | **Separate services** (crash-isolated) | One module dying never kills the line |
| Concurrency | **Multiple modules run simultaneously** | One camera frame feeds many modules in parallel |
| Camera ownership | **Depends on the module** | Camera is its own service; modules share it or own one |
| Location | **Mostly local, occasionally distributed** | Services move across devices with no code change |
| Communication | **Core for control, bus for data (hybrid)** | No bottleneck, natural crash isolation, distribution for free |
| UI ownership | **Core owns the shell; modules mount panels** | One dashboard, each module feeds its own panel |

---

## 3. The five roles

It is not "core + modules." There are five distinct kinds of thing:

1. **Core** â€” the control plane / host app. Supervises, **and owns the shared-memory frame
   transport** (settled 2026-07-28). It moves frame bytes; it **never interprets them.**
2. **Source services** â€” data producers. Capture â†’ **normalize to a canonical format** â†’ publish to a
   topic. Whatever the physical camera, downstream sees one identical frame format.
3. **Module services** â€” the products. Subscribe â†’ process â†’ publish results.
4. **Sink services** â€” result consumers (PLC writer, logger, notifier). Subscribe to results and act.
5. **Vision Runtime** â€” the shared inference *machinery*, a Layer 1 platform service. Loads models,
   runs TensorRT/ONNX, owns GPU memory, batches and schedules. Every GPU module **calls** it; no
   module **contains** it. Optional â€” only GPU modules use it.

Plus the **bus** (dumb transport) and **contracts** (the shared language everyone obeys).

---

## 4. Responsibility map

| Component | Owns | Knows nothing about |
|---|---|---|
| **Bus** | Transport only â€” fans messages out by topic | Any logic |
| **Core** | Config, lifecycle, registry, health, UI shell, **shared-memory frame transport** | Frame *contents* â€” it carries pixels without ever reading them |
| **Source service** | Grabbing frames, **normalizing to canonical format**, publishing camera topic | Anything downstream; what a module's model expects |
| **Module service** | Subscribe â†’ process â†’ publish result; *which* model, thresholds, meaning | GPU/engine plumbing, other modules, sinks |
| **Sink service** | Subscribe to results â†’ act (PLC/DB/alert) | Which module produced the result |
| **Vision Runtime** | Model loading, engine cache, TRT/ONNX exec, GPU memory, batching, scheduling, generic pre/post | What the tensors *mean* â€” that's the module's job |
| **Contracts** | Message format, manifest fields, module + inference interfaces | â€” (everyone depends on it) |

**The one rule that makes it all work:** every service knows only its inputs and outputs **as topics**.
Nothing knows another service's identity or location. That single rule gives crash isolation,
hot-swapping, and distribution for free.

---

## 5. Vision Runtime â€” machinery vs. meaning

If each module loaded its own engine on a shared Jetson you'd get multiple CUDA contexts and GPU pools
(â†’ OOM), no shared batching, and the TRT version difference copied into every module. Centralizing the
machinery fixes all three.

- **Machinery (Layer 1 â€” Vision Runtime):** engine loading, GPU allocation, TRT/ONNX execution, engine
  cache (loaded once, shared, warmed at startup), batching, scheduling, and *generic* pre/post
  (resize, normalize, NMS).
- **Meaning (Layer 2 â€” Module):** *which* model, *when* to infer, thresholds, what the output *means*
  (coverage %, pass/fail, text), and *bespoke* postprocessing (trajectory validation, coverage
  accumulation).

AI Supervisor still "runs its model" â€” it decides and interprets. It just doesn't hold the GPU context.

### Layer ownership

| Concern | Layer |
|---|---|
| Knowing *which* model to use (`ais_x3d`) | **2 â€” App / Module** |
| Model catalog: version, checksum, artifact set, I/O spec | **1 â€” Platform (Model Registry)** |
| Picking *which artifact file* fits this box | **1 â€” Platform (Model Registry)**, from a Layer 3 profile |
| Engine load, GPU alloc, context creation | **1 â€” Platform (Vision Runtime)** |
| Engine cache (keyed, shared, warmed once) | **1 â€” Platform (Vision Runtime)** |
| TensorRT / ONNX execution | **1 â€” Platform (Vision Runtime)** |
| GPU memory management | **1 â€” Platform (Vision Runtime)** |
| Batching + inference scheduling | **1 â€” Platform (Vision Runtime)** |
| Pre/post *mechanics* (resize, normalize, NMS) | **1 â€” Platform (Vision Runtime)** |
| TRT8 / TRT10 API difference | **1 â€” Platform backend** |
| *When* to infer, thresholds, what output *means* | **2 â€” App / Module** |
| Domain postprocessing (trajectory, coverage) | **2 â€” App / Module** |
| Backend / model name / engine params | **3 â€” Config** |

**The rule:** product logic â†’ Layer 2; shared GPU/engine plumbing â†’ Layer 1; config selects between
them.

### 5.1 Model Registry vs. engine cache â€” two components, not one

*Settled 2026-07-28. This resolves the three-way overlap recorded in [CONTEXT.md](CONTEXT.md) Â§11.2.*

"Model loading" was being planned in three places at once. It decomposes into exactly **two**
components with nothing in common but the word *model*, plus one that must not exist:

| Component | Answers | GPU? | Layer |
|---|---|---|---|
| **Model Registry** | *"What is `ais_x3d`?"* â€” version, checksum, artifact set, I/O spec, which artifact fits this box | **No** | 1 (platform, GPU-free) |
| **Engine cache** | *"Give me a runnable engine"* â€” loaded once, shared, warmed, owns the CUDA context | **Yes** | 1 (Vision Runtime) |
| ~~Per-module model loading~~ | â€” | â€” | **Deleted** |

**Per-module model loading is deleted, not rebuilt.** A module that loads its own engine creates a
second CUDA context and GPU pool on a shared Jetson â€” that is P3's OOM failure and a direct violation
of the "a module never contains GPU machinery" invariant. The legitimate part â€” *declaring* which model
a module needs â€” is already covered by `requires.models` in the module manifest, so it costs no code.

**Artifact resolution: the registry picks, the runtime verifies.** Config declares the box profile
(TRT version, GPU arch, JetPack); the registry selects the matching artifact from its catalog; the
runtime asserts on load that the artifact really matches the TensorRT it is linked against, and fails
loudly on mismatch.

```
device.json: gpu_profile { trt: 10, arch: sm_87 }
      â–¼
Registry:  ais_x3d v1.2.0 â”€â–¶ ais_x3d_trt10_fp16.engine   (selection)
      â–¼
Runtime:   assert artifact.trt == linked TRT  â”€â–¶ load â”€â–¶ cache   (verification)
```

This keeps *"config selects; it does not translate"* (Â§11) intact and leaves the runtime dumb, which is
what makes the port a version firewall. The runtime's assert exists because a config profile can drift
from the box's reality â€” the registry is the decision, the runtime is the safety net.

**Why the registry is worth its own component:** it is GPU-free, so it is fully testable with no
hardware attached, and it is what makes the result envelope's `model {model_id, version,
runtime_backend}` trustworthy â€” the chain success test **S11** depends on.

The **Dataset / Model Training Pipeline** is separate from both: it *produces* artifacts that the
registry catalogs. It does not overlap.

### The call, concretely

```
AI Supervisor:   "run ais_x3d on this frame, conf 0.5"
       â–¼
Vision Runtime:  load/cache engine Â· GPU mem Â· batch Â· run TRT Â· NMS Â· return tensors
       â–¼
AI Supervisor:   tensors â†’ "coverage 82%, SOP step 3 done" â†’ publish
```

---

## 6. Lifecycle

### 6.1 Startup â€” the core wakes first
Core boots, reads `config/device.yaml` (what runs on *this* box) and `config/site.yaml` (camera IPs,
model paths, PLC tags, enabled modules). It starts the **bus** first, then services in dependency
order: **sources â†’ sinks â†’ modules**.
*(Open: where the Vision Runtime and its port fit in this order.)*

### 6.2 Registration â€” everyone announces itself
As each service starts it sends a **register** message to the core: *"I'm `ocr`, I need `camera.line1`
+ model `ocr_v3`, I publish `result.ocr`."* The core records this and checks the needs are met. If a
required input isn't being published, the core **flags it** â€” it does not pretend the service is
healthy.

### 6.3 Discovery â€” via the bus, not each other
No service knows another's address. OCR subscribes to the **topic** `camera.line1`, not an IP. Whoever
publishes that topic is irrelevant. This is the root of crash isolation and hot-swapping.

### 6.4 Data flow â€” the hot path

```
Camera service:  capture â”€â–¶ normalize (format + calibrate) â”€â–¶ publish
        â”‚
        â”‚  publishes  { topic: camera.line1, frame_id, timestamp, pixels }
        â”‚             (already canonical â€” same for ANY camera)
        â–¼
     [ BUS ]  â”€â”€ fans the same frame out to every subscriber â”€â”€â”
        â”‚                        â”‚                             â”‚
        â–¼                        â–¼                             â–¼
  AI Supervisor           Image Inspection                    OCR
  reads frame             reads frame                    reads frame
  runs inference          runs inference                 runs inference
  publishes               publishes                      publishes
  result.ais              result.imginsp                 result.ocr
        â”‚                        â”‚                             â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶ [ BUS ] â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚  fans results out to sinks
             â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
             â–¼                 â–¼                 â–¼
        PLC writer          Logger           Notifier
        writes tag        saves to DB       sends alert
```

One frame published once, delivered to all modules in parallel. A slow module never blocks a fast one.
Each result is published once and picked up by whichever sinks care. Because the source **normalizes
before publishing**, every module sees one canonical frame no matter which physical camera produced it.

### 6.5 UI â€” core mounts module panels
The core owns the shell. Each module registered a **UI panel** at startup. When an operator opens the
dashboard, the core renders the shell and mounts the enabled modules' panels inside it â€” coverage bar,
pass/fail, OCR text â€” one screen, each region fed by its own module.

### 6.6 Health & failure â€” crash isolation in practice
The core heartbeats every service. If **OCR crashes**:
- OCR stops replying and stops consuming `camera.line1`.
- The camera keeps publishing â€” it has other subscribers and doesn't notice.
- AI Supervisor and Image Inspection keep running â€” they never knew OCR existed.
- The core marks OCR unhealthy, greys out its panel, and restarts it per policy.
- OCR re-registers, re-subscribes, resumes. Nothing else was touched.

A module is a **leaf** â€” killing it prunes one branch, never the trunk.

### 6.7 Distributed case â€” same code, different location
Because services talk by topic, moving OCR to a second Jetson changes **nothing in code**. Edit
`device.yaml` on box 2 to run OCR there, point both boxes at the same bus, and frames cross the
network transparently. **Local vs. distributed is a config decision, not a code decision.**

---

## 7. Runtime architecture (layered view)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        CONTROL PLANE (CORE)                          â”‚
â”‚  config Â· registry Â· lifecycle Â· health/heartbeat Â· UI shell Â·       â”‚
â”‚  shared-memory frame transport                                       â”‚
â”‚  (supervises everything below â€” carries frames, never reads them)    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        â”‚ starts / monitors / mounts panels        â–² register + heartbeat
        â–¼                                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          DATA PLANE (BUS)                            â”‚
â”‚        dumb transport Â· fans messages out by topic (pub/sub)         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
    â–² camera.*          â–² camera.*          â”‚ result.*        â”‚ result.*
    â”‚                   â”‚                   â–¼                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ SOURCES â”‚      â”‚   MODULES    â”‚     â”‚    SINKS     â”‚   â”‚  UI PANELS   â”‚
â”‚ camera  â”‚â”€â”€â”€â”€â”€â–¶â”‚ ai_supervisorâ”‚â”€â”€â”€â”€â–¶â”‚ plc_writer   â”‚   â”‚ (in core UI) â”‚
â”‚ gige    â”‚      â”‚ image_insp   â”‚     â”‚ logger       â”‚   â”‚ live results â”‚
â”‚ usb3    â”‚      â”‚ ocr          â”‚     â”‚ notifier     â”‚   â”‚              â”‚
â”‚ rtsp    â”‚      â”‚ (+ more)     â”‚     â”‚              â”‚   â”‚              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 produce frames         â”‚ infer request / tensors back    act on results
                        â–¼
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚   VISION RUNTIME   â”‚  â† Layer 1 platform service
              â”‚  model load Â· TRT/ â”‚    (shared by all GPU modules)
              â”‚  ONNX Â· GPU mem Â·  â”‚
              â”‚  batch Â· schedule  â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

Modules sit in the data plane but **call the Vision Runtime** for all GPU work â€” shared machinery, not
per-module code.

---

## 8. Folder layout

```
factory-vision/
â”‚
â”œâ”€â”€ core/                       # control plane â€” the host app
â”‚   â”œâ”€â”€ bus/                     # bus client wrapper all services reuse
â”‚   â”œâ”€â”€ config/                  # loads device.yaml + site.yaml
â”‚   â”œâ”€â”€ registry/                # who's installed, enabled, registered
â”‚   â”œâ”€â”€ lifecycle/               # start/stop/restart in dependency order
â”‚   â”œâ”€â”€ health/                  # heartbeat pinger + restart policy
â”‚   â””â”€â”€ ui/                      # UI shell; mounts module panels
â”‚
â”œâ”€â”€ contracts/                  # GLOBAL agreement â€” the grammar everyone speaks
â”‚   â”œâ”€â”€ message_schema/          # frame envelope + result envelope format
â”‚   â”œâ”€â”€ bus_topics/              # topic naming rules (camera.* / result.*)
â”‚   â”œâ”€â”€ service_interface/       # register + heartbeat every service implements
â”‚   â”œâ”€â”€ module_interface/        # methods every module must expose
â”‚   â””â”€â”€ inference_contract/      # Vision Runtime call/response (Layer 1 wire format)
â”‚
â”œâ”€â”€ platform/                   # Layer 1 shared services (OS/CUDA-coupled live here)
â”‚   â””â”€â”€ vision_runtime/          # reached over a port  (open: own repo vs. in-tree)
â”‚       â”œâ”€â”€ backends/            # trt/ Â· onnx/ Â· torch/   (selected by config)
â”‚       â”œâ”€â”€ engine_cache/        # loaded engines, keyed + shared + warmed
â”‚       â”œâ”€â”€ memory/              # GPU pool / allocator
â”‚       â”œâ”€â”€ scheduler/           # batching + inference queue
â”‚       â””â”€â”€ pre_post/            # resize, normalize, NMS primitives
â”‚
â”œâ”€â”€ sources/                    # producers â€” each: capture â†’ normalize â†’ publish
â”‚   â”œâ”€â”€ camera_gige/             # Hikrobot GigE source service
â”‚   â”‚   â”œâ”€â”€ capture              # talk to Hikrobot SDK, grab raw frame
â”‚   â”‚   â”œâ”€â”€ normalize/           # â† the data-standardizing stage (per camera)
â”‚   â”‚   â”‚   â”œâ”€â”€ format           #   canonical envelope: BGR, resolution, bit depth
â”‚   â”‚   â”‚   â””â”€â”€ calibrate        #   undistort, crop to canonical FOV, colour-correct
â”‚   â”‚   â””â”€â”€ publish              # emit standard frame envelope on camera.lineX
â”‚   â”œâ”€â”€ camera_usb3/             # USB3 source (same captureâ†’normalizeâ†’publish shape)
â”‚   â””â”€â”€ camera_rtsp/             # RTSP source (same shape)
â”‚
â”œâ”€â”€ modules/                    # the products â€” drop a folder to add one
â”‚   â”œâ”€â”€ ai_supervisor/           # SOP compliance
â”‚   â”‚   â”œâ”€â”€ manifest             # needs camera.lineX, model, PLC tags
â”‚   â”‚   â”œâ”€â”€ contract/            # its OWN result schema (coverage, SOP step)
â”‚   â”‚   â”œâ”€â”€ service              # subscribe â†’ process â†’ publish
â”‚   â”‚   â””â”€â”€ ui_panel             # coverage bar shown in core UI
â”‚   â”œâ”€â”€ image_inspection/        # manifest Â· contract/ Â· service Â· ui_panel
â”‚   â””â”€â”€ ocr/                     # manifest Â· contract/ Â· service Â· ui_panel
â”‚
â”œâ”€â”€ sinks/                      # result consumers
â”‚   â”œâ”€â”€ plc_writer/              # subscribes result.*, writes S7 tags
â”‚   â”œâ”€â”€ logger/                  # subscribes result.*, saves to DB
â”‚   â””â”€â”€ notifier/                # subscribes result.*, sends alerts
â”‚
â””â”€â”€ config/                     # per-site / per-device â€” the ONLY thing that changes
    â”œâ”€â”€ device.yaml              # which services run on THIS box
    â””â”€â”€ site.yaml                # camera IPs, model paths, PLC tags, enabled modules
```

---

## 9. Contracts live at two levels

- **Global (`contracts/`)** â€” the *shared language* nobody owns and everyone obeys: frame + result
  envelopes, bus topic naming, the register/heartbeat interface, the module interface, and the
  **inference contract** (the Vision Runtime's wire format). A module can't invent its own frame
  format or the fan-out breaks.
- **Per-module (`modules/<x>/contract/`)** â€” each module's *own dialect*: what it declares in its
  manifest (needs/provides) and its **specific result schema**. AI Supervisor's result (coverage %,
  SOP step) differs from OCR's (text, confidence). That belongs *with the module*.

**The rule:** global = the grammar everyone must speak; per-module = the specific words that module
says. The inference contract sits in the global set because every module calls the Runtime the same
way â€” and, per Â§11, that contract is also the version firewall.

---

## 10. The data-standardizing layer â€” any camera, same frame

Goal: change the camera and no module changes. This lives in the source service's **`normalize` stage**
(capture â†’ normalize â†’ publish), not as a separate bus hop â€” normalizing at the edge means one publish
of an already-canonical frame, with no extra round trip at 30fps.

It splits in two, because "same data from any camera" means two different things:

- **Format normalization (`normalize/format`)** â€” the *shape* of the data: pixel format (BGR/RGB/raw
  Bayer), resolution, colour space, bit depth, and the envelope wrapper (frame_id, timestamp, topic).
  Enforced by the global **frame-envelope contract**: a GigE service and a USB3 service emit an
  identical envelope. Change the camera â†’ swap the source build â†’ envelope unchanged â†’ nothing
  downstream moves.
- **Content / geometry normalization (`normalize/calibrate`)** â€” the *optics*: two cameras can share a
  format yet differ in lens distortion, FOV, mounting angle, white balance, or mm-per-pixel, any of
  which degrades a model trained on the other. This stage undistorts, crops to a canonical FOV, and
  colour-corrects â€” driven by **per-camera config**, not code:

```yaml
site.yaml:
  camera.line1:
    calibration: line1_cam.yaml    # distortion coeffs, crop box, colour matrix
    target_format: bgr_1080p
```

Change the camera â†’ update that camera's calibration config (or swap the source build if the SDK
differs) â†’ **modules and the Vision Runtime receive the exact same normalized frame as before. Zero
change to inference or any module.**

> **Honest limit:** format + geometry normalization make a new camera *look* like the old one, but they
> can't erase a real **optical** gap â€” a much lower-resolution sensor, a very different lens, or poor
> lighting still changes what the model sees. For a model like AI Supervisor's X3D-S (trained on a
> small, imbalanced dataset), a genuinely different camera may still want a validation pass or a few
> fine-tuning samples. Treat "any camera, zero revalidation" as a target you approach, not a guarantee.

---

## 11. Surviving OS / hardware / version changes

*OS change = config change* is real, but only because a platform layer absorbs the differences. Config
**selects** a pre-built implementation; it does not translate CUDA versions. Three bands:

- **Product code (Layer 2/3)** â€” module logic, thresholds, publishing. Pure Python. **Identical on
  every OS.**
- **Platform layer (Layer 1)** â€” Vision Runtime backend + camera source. Touch native libs (TensorRT,
  CUDA, Hikrobot SDK) that differ per OS. Not *edited* per OS â€” **built once per OS**, exposing the
  same interface upward.
- **OS + driver stack** â€” a prerequisite the box must have; not something we ship.

The platform layer isn't just code â€” it's a whole *environment* per OS:

| Axis | JetPack 5.1 (dev) | JetPack 6 (deploy) | Windows GPU PC |
|---|---|---|---|
| OS | Ubuntu 20.04 (L4T 35) | Ubuntu 22.04 (L4T 36) | Windows + WSL2 / native |
| CUDA / TRT | 11.4 / TRT 8 | 12.x / TRT 10 | 12.x / TRT 10 |
| Python | 3.8 | 3.10 | 3.11 |
| torch / onnxruntime | L4T wheels (CUDA 11.4) | L4T wheels (CUDA 12) | PyPI CUDA-12 wheels |
| Camera SDK | Hikrobot ARM/L4T | Hikrobot ARM/L4T | Hikrobot x86 Windows |
| **Product/module code** | **identical** | **identical** | **identical** |

The packaging unit is therefore a **Docker image per OS** (`vision:jetpack5`, `vision:jetpack6`, +
Windows profile). On Jetson, build `FROM` an NVIDIA `nvcr.io` L4T base image and add pinned wheels
from NVIDIA's Jetson pip index. The image freezes the environment; config names which image runs.

### What actually changes on an OS switch â€” three tiers

- **Tier 1 â€” never changes.** Module logic, thresholds, math, publishing. The bulk of the code.
- **Tier 2 â€” once per OS, at build time; environment, not code.** Python version + CUDA-matched wheels
  + native libs, assembled and frozen in a Dockerfile. Cost is **once per OS, not per deployment**.
- **Tier 3 â€” small, localized code.** The TRT8â†’TRT10 API difference, isolated in **one backend file**.
  Rare Python-version deltas, avoidable by writing to the lowest supported version.

### Tier 2 image checklist
Base NVIDIA L4T image (pinned tag) â†’ CUDA/cuDNN/TRT â†’ pinned Python â†’ CUDA-matched wheels (torch,
onnxruntime, tensorrt bindings, numpy â€” from NVIDIA's index, **not** PyPI) â†’ compiled vision libs
(OpenCV, GStreamer) â†’ camera SDK â†’ exact-version lockfile â†’ `Dockerfile.jp5` / `Dockerfile.jp6` /
Windows profile. The two that cost real time on JP5â†’JP6: finding the JP6 wheels, and the TRT8â†’TRT10
change.

### Standardize what you own; isolate what you don't
GPU inference is coupled to its CUDA/TRT/driver stack â€” no architecture removes that. Good architecture
moves the cost from *per-deployment-by-hand* to *per-OS-in-a-Dockerfile*:

- **Standardize** the code you control (pure-Python libs, bus client, contracts) â€” one pinned version
  everywhere.
- **Isolate** the code you don't â€” confine CUDA/TRT to **one port-speaking service** (the Vision
  Runtime, its own environment). The port doesn't unify the version; it makes the version *irrelevant
  to the caller*.

**The port is a version firewall.** On a JP5â†’JP6 move the Vision Runtime is rebuilt (new TRT, wheels,
container) but the **inference contract** stays identical â†’ AI Supervisor sends the same request before
and after and notices nothing. That is what "OS change â†’ no change in inference" means. The fewer
places that touch CUDA, the smaller the isolated surface â€” ideally the whole CUDA-coupled surface is
one repo.

**Data-path note:** frames are big â€” don't serialize raw pixels over a socket at 30fps. The frame rides
in **shared memory**; the port carries only the small "run model X on frame slot 7" control message.

**Open:** Vision Runtime behind the port now; promote the camera SDK to a port service only if/when the
Windows x86 target becomes real. It already publishes by topic, so it can be promoted later without
touching any module.

---

## 12. Adding a new module

1. Drop a folder into `modules/` with three parts: `manifest`, `service`, `ui_panel`.
2. The service registers itself with the core on startup (declares needs + provides).
3. Enable it in `config/site.yaml` â†’ `enabled_modules: [ai_supervisor, ocr, new_module]`.
4. Restart. The core loads it, it subscribes to its input topic, and starts publishing results.

**No core code changes. No other module touched.** That is the whole point.

---

## 13. The one boundary that makes or breaks it

The **global `contracts/`** â€” the frame/result envelopes, the module interface, and above all the
**inference contract**. As long as every module obeys it, the core treats them identically, modules stay
ignorant of each other, and the Vision Runtime can be rebuilt for a new TRT without any caller
noticing.

The inference contract does double duty: it is the moduleâ†”runtime interface *and* the version firewall
between stable code and the CUDA-coupled world. If one module cheats â€” reaching into core internals,
another module, or linking CUDA directly instead of going through the runtime â€” the system rots back
into a monolith *and* the OS-portability property breaks. Guard that boundary and everything else stays
flexible.

---

## 14. Tech stack â€” the right language per role

Modules can be written in **any language** because they only speak the bus wire format â€” nothing links
another component's code. Each role's constraints pick a natural default:

> **Canonical language policy now lives in [LANGUAGES.md](LANGUAGES.md).** This table is kept in sync
> with it; if the two ever disagree, LANGUAGES.md wins.

| Role | Language | Why |
|---|---|---|
| Core / platform (supervisor **+ frame transport**) | **Rust** | Core owns the shared-memory hot path (settled 2026-07-28), so it must be a systems language; Rust adds memory safety on the component everything depends on, and cross-compiles to Ubuntu + Windows + Jetson ARM |
| Vision Runtime (GPU) | **C++ or Python** | Bound to CUDA/TRT; the one genuinely per-platform piece |
| ML / vision modules | **Python** | The ML ecosystem lives here; calls the Vision Runtime for heavy work |
| QC / logic modules (e.g. Crowning) | **Any** | Pure logic â€” Python to build fast, Go/Rust if it must be light |
| Desktop UI | **Tauri** (web frontend + Rust shell) | Native window (no browser), light (OS webview, not bundled Chromium), cross-platform |

The former separate "hot data path (C++ or Rust)" row is **absorbed into Core**, since Core now owns
that path. This lowers the language count rather than raising it â€” a direct win against the polyglot
cost in Â§4 / P13.

They coexist because the **bus contract** is the only thing they share â€” a Go core, a C++ runtime,
Python modules, and a Rust-shelled UI exchange messages, never code. Cross-compilation
(`GOOS=linux/windows`, `GOARCH=amd64/arm64`) produces the native core binary per target from one
codebase.

**UI model:** the desktop app is web tech (HTML/CSS/JS, React or Svelte) rendered in a **native window**
via Tauri â€” the user never sees a browser. It's one more client of the platform: it talks to the Go core
over the bus/local socket (subscribes to result topics, calls the control API) and can bundle and launch
the Go binary as a sidecar so everything installs as one app. Same model as VS Code / Slack / Discord, in
its lighter OS-webview form.

> **Caveat â€” polyglot cost.** Go + Python + C++ + Rust + web is powerful and a real operational load
> (build tooling, debugging, hiring across language worlds). The architecture supports the full spread;
> for a two-person team it's worth consciously narrowing â€” lean Python for anything not forced to be
> Go/C++ â€” to keep the surface manageable.

> **Caveat â€” live video in the UI.** Dashboards, results, and config render effortlessly in a webview;
> streaming live 30fps feeds with overlays needs a deliberate approach (local stream to the UI, or a
> native video layer). It's the one thing to prototype early if the operator screen must show live
> video. Industrial HMIs heavy on live feeds sometimes prefer **Qt** for this reason.



