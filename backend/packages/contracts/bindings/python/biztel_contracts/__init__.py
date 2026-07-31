"""Vision Intel Platform contracts -- Python binding.

The global language every component obeys. This is the Python binding, one of
several under ``packages/contracts/bindings/`` -- no binding is primary. Every
binding is held to the same corpus in ``packages/contracts/fixtures``; if two
disagree on a case, one of them fails its build.

See LANGUAGES.md section 2 for which binding each contract needs and why.
"""
from .bus_topics import (
    CANONICAL_TOPICS,
    TOPIC_FAMILIES,
    TopicError,
    assert_topic,
    assert_topic_pattern,
    is_camera_topic,
    is_result_topic,
    is_topic,
    is_topic_pattern,
    topic_family,
    topic_matches,
)
from .frame_envelope import (
    CalibrationRef,
    FrameEnvelope,
    FrameFormat,
    PayloadRef,
    create_mock_frame,
    utc_now,
)
from .inference_contract import (
    InferenceError,
    InferenceRequest,
    InferenceResponse,
)
from .module_interface import (
    MODULE_LIFECYCLE_NAMES,
    Module,
    ModuleLifecycle,
    ModuleManifest,
    ModuleProvides,
    ModuleRequires,
    UiPanel,
)
from .result_envelope import ModelRef, ResultEnvelope, ResultError

__version__ = "0.1.0"

__all__ = [
    "__version__",
    # bus topics
    "TOPIC_FAMILIES",
    "CANONICAL_TOPICS",
    "TopicError",
    "is_topic",
    "assert_topic",
    "is_topic_pattern",
    "assert_topic_pattern",
    "topic_family",
    "topic_matches",
    "is_camera_topic",
    "is_result_topic",
    # frame envelope
    "FrameEnvelope",
    "FrameFormat",
    "CalibrationRef",
    "PayloadRef",
    "create_mock_frame",
    "utc_now",
    # result envelope
    "ResultEnvelope",
    "ModelRef",
    "ResultError",
    # module interface
    "Module",
    "ModuleManifest",
    "ModuleRequires",
    "ModuleProvides",
    "ModuleLifecycle",
    "UiPanel",
    "MODULE_LIFECYCLE_NAMES",
    # inference contract
    "InferenceRequest",
    "InferenceResponse",
    "InferenceError",
]
