"""Service interface -- registration, heartbeat, and shutdown messages.

Owner: Samarth. This is the Python binding of the shared service interface
schema. Services use it to register with Core, report liveness, and receive
controlled shutdown commands.

Targets Python 3.8; see docs/legacy-languages.md.
"""
from typing import Dict, List, Optional, Union

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

from .bus_topics import is_topic, is_topic_pattern
from .frame_envelope import _parse_iso8601

ServiceRole = Literal[
    "core",
    "source",
    "module",
    "sink",
    "vision_runtime",
    "plc",
    "storage",
    "ui",
]
RuntimeState = Literal["starting", "running", "degraded", "error", "stopped"]
MetadataValue = Union[StrictBool, StrictInt, StrictFloat, StrictStr]
MetricValue = Union[StrictInt, StrictFloat]


class ServiceRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["service-registration.v1"]
    service_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    role: ServiceRole
    version: str = Field(min_length=1)
    host_id: str = Field(min_length=1)
    process_id: Optional[StrictInt] = Field(default=None, gt=0)
    subscribes: List[str] = Field(default_factory=list)
    publishes: List[str] = Field(default_factory=list)
    health_topic: str = "health.heartbeat"
    started_at_utc: str
    metadata: Dict[str, MetadataValue] = Field(default_factory=dict)

    @field_validator("subscribes")
    @classmethod
    def _check_subscribes(cls, value: List[str]) -> List[str]:
        for pattern in value:
            if not is_topic_pattern(pattern):
                raise ValueError("subscription %r is not a valid topic pattern" % (pattern,))
        return value

    @field_validator("publishes")
    @classmethod
    def _check_publishes(cls, value: List[str]) -> List[str]:
        for topic in value:
            if not is_topic(topic):
                raise ValueError("publish topic %r is not a concrete topic" % (topic,))
        return value

    @field_validator("health_topic")
    @classmethod
    def _check_health_topic(cls, value: str) -> str:
        if not is_topic(value):
            raise ValueError("health_topic must be a valid topic, got %r" % (value,))
        return value

    @field_validator("started_at_utc")
    @classmethod
    def _check_started_at(cls, value: str) -> str:
        _parse_iso8601(value)
        return value


class ServiceHeartbeat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["service-heartbeat.v1"]
    service_id: str = Field(min_length=1)
    state: RuntimeState
    timestamp_utc: str
    uptime_ms: StrictInt = Field(ge=0)
    message: Optional[str] = None
    metrics: Dict[str, MetricValue] = Field(default_factory=dict)

    @field_validator("timestamp_utc")
    @classmethod
    def _check_timestamp(cls, value: str) -> str:
        _parse_iso8601(value)
        return value


class ShutdownCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["service-shutdown.v1"]
    service_id: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    requested_by: str = Field(min_length=1)
    timestamp_utc: str

    @field_validator("timestamp_utc")
    @classmethod
    def _check_timestamp(cls, value: str) -> str:
        _parse_iso8601(value)
        return value


__all__ = [
    "ServiceRegistration",
    "ServiceHeartbeat",
    "ShutdownCommand",
]
