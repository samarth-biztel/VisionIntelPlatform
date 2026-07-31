"""Frame envelope -- the canonical frame every source publishes.

Owner: Chetak. Consumed by source services, ML/vision modules, the Vision
Runtime, and future core transport. This is the Python binding of the shared
schema.

A source normalizes (format + calibration) *before* publishing, so every module
downstream sees this identical shape no matter which physical camera produced
the frame. See ARCHITECTURE.md section 10.

Targets Python 3.8; see docs/legacy-languages.md.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union

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

from .bus_topics import is_topic

SCHEMA_VERSION = "frame-envelope.v1"

PixelFormat = Literal["BGR8", "RGB8", "GRAY8", "BAYER_RG8"]
ColorSpace = Literal["BGR", "RGB", "GRAY", "RAW"]
Transport = Literal["shared_memory", "file", "inline_mock"]

# Strict members are required: with a plain Union[str, int, float, bool],
# pydantic's smart-union *serializer* emits True as 1.0, so a boolean would
# reach the JS binding as a number. JSON is the wire format here -- the
# round-trip has to be exact. Covered by the round_trip fixtures.
MetadataValue = Union[StrictBool, StrictInt, StrictFloat, StrictStr]


class FrameFormat(BaseModel):
    """The *shape* of the pixels -- normalize/format's output."""

    model_config = ConfigDict(extra="forbid")

    pixel_format: PixelFormat
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    channels: int = Field(gt=0)
    bit_depth: int = Field(gt=0)
    color_space: ColorSpace


class CalibrationRef(BaseModel):
    """Which calibration produced this frame's geometry -- normalize/calibrate."""

    model_config = ConfigDict(extra="forbid")

    calibration_id: str = Field(min_length=1)
    camera_model: Optional[str] = Field(default=None, min_length=1)
    profile_path: Optional[str] = Field(default=None, min_length=1)
    target_format: str = Field(min_length=1)


class PayloadRef(BaseModel):
    """Where the pixels actually live.

    Deliberately loose on ``ref`` while the shared-memory transport is unbuilt;
    frames ride shared memory, never a per-frame socket serialization
    (MEMORY.md invariant 7).
    """

    model_config = ConfigDict(extra="forbid")

    transport: Transport
    ref: str = Field(min_length=1)
    byte_length: Optional[int] = Field(default=None, ge=0)
    checksum: Optional[str] = Field(default=None, min_length=1)


class FrameEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["frame-envelope.v1"]
    frame_id: str = Field(min_length=1)
    timestamp_utc: str
    source_topic: str
    source_id: str = Field(min_length=1)
    sequence: int = Field(ge=0)
    format: FrameFormat
    calibration: CalibrationRef
    payload: PayloadRef
    metadata: Dict[str, MetadataValue] = Field(default_factory=dict)

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
            raise ValueError("Frame source_topic must start with camera.")
        return value


def _parse_iso8601(value: str) -> datetime:
    """Accept the ISO-8601 form JavaScript's toISOString() emits."""
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO-8601 string")
    text = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        raise ValueError("timestamp must be an ISO-8601 datetime, got %r" % (value,))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must carry a timezone offset, got %r" % (value,))
    return parsed


def utc_now() -> str:
    """Timestamp in the shared ISO-8601 wire format."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def create_mock_frame(**overrides: Any) -> FrameEnvelope:
    """A valid synthetic frame -- the hardware-free path for tests (S8)."""
    payload: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "frame_id": "mock-frame-000001",
        "timestamp_utc": utc_now(),
        "source_topic": "camera.line1",
        "source_id": "mock-source",
        "sequence": 1,
        "format": {
            "pixel_format": "BGR8",
            "width": 1920,
            "height": 1080,
            "channels": 3,
            "bit_depth": 8,
            "color_space": "BGR",
        },
        "calibration": {
            "calibration_id": "line1-default",
            "target_format": "bgr_1080p",
        },
        "payload": {
            "transport": "inline_mock",
            "ref": "synthetic://line1/frame/000001",
        },
        "metadata": {},
    }
    payload.update(overrides)
    return FrameEnvelope(**payload)


__all__ = [
    "SCHEMA_VERSION",
    "FrameEnvelope",
    "FrameFormat",
    "CalibrationRef",
    "PayloadRef",
    "create_mock_frame",
    "utc_now",
]
