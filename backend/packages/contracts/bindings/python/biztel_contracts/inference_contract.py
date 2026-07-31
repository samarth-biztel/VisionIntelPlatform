"""Inference contract -- the module to Vision Runtime wire format.

Owner: Chetak. This is the Python binding of the shared inference schema.

This contract does double duty (ARCHITECTURE.md section 13):

1. It is the interface every GPU module uses to call the Vision Runtime.
2. It is the **version firewall**. On a JetPack 5 to JetPack 6 move the Runtime
   is rebuilt against a new TensorRT, but this contract stays identical, so
   AI Supervisor sends the same request before and after and notices nothing.

Guard it above all else. A module that links CUDA directly instead of calling
through here breaks both modularity and OS portability at once.

**Deliberately loose, for now.** ``frame_payload_ref`` is an opaque string and
``tensors`` is free-form. Frames ride shared memory and the port carries only a
small "run model X on frame slot N" control message (MEMORY.md invariant 7),
but the shared-memory transport is unbuilt -- so this stays flexible rather than
committing to a slot/segment layout that the Runtime has not validated yet.
Tighten it when Tier 3 starts.

Targets Python 3.8; see docs/legacy-languages.md.
"""
from typing import Any, Dict, List, Optional, Union

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    field_validator,
)
from typing_extensions import Literal

from .frame_envelope import _parse_iso8601, utc_now

REQUEST_SCHEMA_VERSION = "inference-request.v1"
RESPONSE_SCHEMA_VERSION = "inference-response.v1"

Backend = Literal["trt", "onnx", "torch"]
# Strict members required -- see the note on MetadataValue in frame_envelope.py.
# An inference parameter like {"half": true} must not arrive at the Runtime as 1.0.
ParameterValue = Union[StrictBool, StrictInt, StrictFloat, StrictStr]


class InferenceError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)


class InferenceRequest(BaseModel):
    """"Run model X on this frame."

    The module says *which* model and *with what thresholds* (Layer 2 -- meaning).
    It says nothing about engines, GPU memory, or batching (Layer 1 -- machinery).
    """

    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    schema_version: Literal["inference-request.v1"]
    request_id: str = Field(min_length=1)
    module_id: str = Field(min_length=1)
    model_id: str = Field(min_length=1)
    frame_id: str = Field(min_length=1)
    # Opaque by design -- see module docstring.
    frame_payload_ref: str = Field(min_length=1)
    backend_hint: Optional[Backend] = None
    parameters: Dict[str, ParameterValue] = Field(default_factory=dict)
    timestamp_utc: str

    @field_validator("timestamp_utc")
    @classmethod
    def _check_timestamp(cls, value: str) -> str:
        _parse_iso8601(value)
        return value


class InferenceResponse(BaseModel):
    """Raw tensors back. The Runtime does not know what they *mean*."""

    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    schema_version: Literal["inference-response.v1"]
    request_id: str = Field(min_length=1)
    model_id: str = Field(min_length=1)
    backend: Backend
    latency_ms: float = Field(ge=0)
    # Free-form until the Runtime pins a tensor descriptor -- see docstring.
    tensors: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[InferenceError] = None
    timestamp_utc: str

    @field_validator("timestamp_utc")
    @classmethod
    def _check_timestamp(cls, value: str) -> str:
        _parse_iso8601(value)
        return value


__all__ = [
    "REQUEST_SCHEMA_VERSION",
    "RESPONSE_SCHEMA_VERSION",
    "InferenceRequest",
    "InferenceResponse",
    "InferenceError",
    "utc_now",
]
