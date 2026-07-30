"""Result envelope -- what every module publishes after processing a frame.

Owner: Chetak. Consumed by ML/vision modules (producers) and sinks + UI
(consumers). Python binding of ``src/result-envelope.js``.

A sink never learns which module produced a result -- it subscribes to a topic.
The envelope carries ``frame_id`` so any result traces back to its frame, its
source, and its model version (success test S11).

Targets Python 3.8; see LANGUAGES.md section 3.
"""
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing_extensions import Literal

from .bus_topics import is_topic
from .frame_envelope import _parse_iso8601, utc_now

SCHEMA_VERSION = "result-envelope.v1"

Verdict = Literal["pass", "fail", "warn", "unknown", "error"]
RuntimeBackend = Literal["trt", "onnx", "torch", "classical_cv", "none"]


class ModelRef(BaseModel):
    """Which model produced this result -- required for traceability."""

    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    model_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    runtime_backend: RuntimeBackend


class ResultError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)


class ResultEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    schema_version: Literal["result-envelope.v1"]
    result_id: str = Field(min_length=1)
    frame_id: str = Field(min_length=1)
    source_topic: str
    result_topic: str
    module_id: str = Field(min_length=1)
    verdict: Verdict
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    latency_ms: float = Field(ge=0)
    model: Optional[ModelRef] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[ResultError] = None
    timestamp_utc: str

    @field_validator("timestamp_utc")
    @classmethod
    def _check_timestamp(cls, value: str) -> str:
        _parse_iso8601(value)
        return value

    @field_validator("source_topic")
    @classmethod
    def _check_source_topic(cls, value: str) -> str:
        if not is_topic(value):
            raise ValueError("source_topic must be a valid topic, got %r" % (value,))
        if not value.startswith("camera."):
            raise ValueError("Result source_topic must start with camera.")
        return value

    @field_validator("result_topic")
    @classmethod
    def _check_result_topic(cls, value: str) -> str:
        if not is_topic(value):
            raise ValueError("result_topic must be a valid topic, got %r" % (value,))
        if not value.startswith("result."):
            raise ValueError("Result topic must start with result.")
        return value


__all__ = [
    "SCHEMA_VERSION",
    "ResultEnvelope",
    "ModelRef",
    "ResultError",
    "utc_now",
]
