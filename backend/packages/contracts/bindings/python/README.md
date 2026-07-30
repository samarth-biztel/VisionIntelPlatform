# biztel-contracts â€” Python binding

The Python side of the platform contracts. This is what **AI Supervisor, Image Inspection, OCR,
Crowning, and the Vision Runtime** import.

Targets **Python 3.8** (the JetPack 5.1 floor) and runs unchanged on JetPack 6 (3.10) and Windows
(3.11). See [LANGUAGES.md](../../../../LANGUAGES.md) Â§3.

```bash
pip install -e packages/contracts/bindings/python
```

---

## What's here

| Contract | Module | Owner |
|---|---|---|
| Frame envelope | `biztel_contracts.frame_envelope` | Chetak |
| Result envelope | `biztel_contracts.result_envelope` | Chetak |
| Module interface + manifest | `biztel_contracts.module_interface` | Chetak |
| Inference contract | `biztel_contracts.inference_contract` | Chetak |
| Bus topic naming | `biztel_contracts.bus_topics` | Samarth (rule) |

---

## Writing a module

Subclass `Module`, declare a manifest, implement `init` and `on_frame`. That is the whole interface.

```python
from biztel_contracts import Module, ModuleManifest, create_mock_frame

MANIFEST = ModuleManifest(
    schema_version="module-manifest.v1",
    module_id="ai_supervisor",
    display_name="AI Supervisor",
    version="0.1.0",
    owner="Chetak",
    kind="vision_gpu",
    requires={
        "input_topics": ["camera.line1"],
        "models": ["ais_x3d"],
        "config_keys": ["site.thresholds.coverage"],
        "services": ["vision_runtime"],
    },
    provides={
        "result_topics": ["result.ai-supervisor"],
        "ui_panel": {"route": "/modules/ai-supervisor", "mount_slot": "dashboard"},
    },
    lifecycle={
        "init": "init(config)",
        "frame_handler": "on_frame(frame_envelope)",
        "publish": "publish(result_envelope)",
        "teardown": "teardown()",
    },
)


class AiSupervisor(Module):
    manifest = MANIFEST

    def init(self, config):
        self.threshold = config["thresholds"]["coverage"]
        self.runtime = config["vision_runtime"]   # a client, not an engine

    def on_frame(self, frame):
        # Layer 1 does the GPU work. This module never touches CUDA.
        response = self.runtime.infer(
            model_id="ais_x3d",
            frame_payload_ref=frame.payload.ref,
            parameters={"conf": 0.5},
        )

        # Layer 2 decides what the tensors *mean*.
        coverage = self.interpret(response.tensors)

        return self.make_result(
            frame,
            verdict="pass" if coverage >= self.threshold else "fail",
            confidence=coverage,
            latency_ms=response.latency_ms,
            model={"model_id": "ais_x3d", "version": "1.2.0", "runtime_backend": "trt"},
            payload={"coverage_pct": round(coverage * 100, 1)},
        )
```

`make_result()` fills in `frame_id`, `source_topic`, `result_topic`, and `module_id` for you, so a
module cannot accidentally break traceability. Return `None` from `on_frame` to publish nothing for
that frame â€” deciding *when* to infer is the module's job.

---

## The two rules this package enforces

1. **A module never contains GPU machinery.** It calls the Vision Runtime through the inference
   contract. Modules that load their own engines create multiple CUDA contexts on one Jetson and OOM.
   Machinery is Layer 1; meaning is Layer 2, and `Module` is Layer 2 only.
2. **No module calls another module.** A module is handed its config and a publish callback. It is
   given no route to the bus, the core, or another service.

---

## Conformance

Both language bindings run the **same** fixture corpus, `../../fixtures/conformance.json`:

```bash
python3 packages/contracts/bindings/python/conformance_test.py   # python binding
node packages/contracts/bindings/javascript/src/conformance-test.js   # js binding
npm run test --workspace @biztel/contracts               # both
```

74 shared cases run identically on both sides. If a binding drifts â€” accepts something the other
rejects â€” its build fails naming the exact case. Adding a case to the JSON automatically holds every
binding to it.

This is success test **S8** in [PROBLEM_STATEMENT.md](../../../../PROBLEM_STATEMENT.md): contract
conformance asserted automatically, against synthetic data, with no hardware attached.



