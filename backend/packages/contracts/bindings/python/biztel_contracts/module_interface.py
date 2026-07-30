"""Module interface -- what every module service implements, plus its manifest.

Python binding of the JavaScript module manifest contract. A module declares
what it needs, what it provides, and the lifecycle hooks the core can call.
"""
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing_extensions import Literal

from .bus_topics import is_topic, is_topic_pattern
from .frame_envelope import FrameEnvelope
from .result_envelope import ResultEnvelope

SCHEMA_VERSION = "module-manifest.v1"

ModuleKind = Literal["vision_gpu", "vision_classical", "metrology", "logic"]
RequiredService = Literal["vision_runtime", "plc", "storage"]

MODULE_LIFECYCLE_NAMES = (
    "init(config)",
    "on_frame(frame_envelope)",
    "publish(result_envelope)",
    "teardown()",
)


class UiPanel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route: str = Field(min_length=1)
    mount_slot: str = Field(min_length=1)


class ModuleNeeds(BaseModel):
    """What the module declares it needs. The core checks these are met."""

    model_config = ConfigDict(extra="forbid")

    input_topics: List[str]
    models: List[str] = Field(default_factory=list)
    config_keys: List[str] = Field(default_factory=list)
    services: List[RequiredService] = Field(default_factory=list)

    @field_validator("input_topics")
    @classmethod
    def _check_input_topics(cls, value: List[str]) -> List[str]:
        for topic in value:
            if not is_topic_pattern(topic):
                raise ValueError("input topic %r is not a valid topic or pattern" % (topic,))
        return value


ModuleRequires = ModuleNeeds


class ModuleProvides(BaseModel):
    """What the module declares it produces."""

    model_config = ConfigDict(extra="forbid")

    result_topics: List[str]
    ui_panel: Optional[UiPanel] = None

    @field_validator("result_topics")
    @classmethod
    def _check_result_topics(cls, value: List[str]) -> List[str]:
        for topic in value:
            if not is_topic(topic):
                raise ValueError("result topic %r is not a concrete topic" % (topic,))
        return value


class ModuleLifecycle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    init: Literal["init(config)"]
    frame_handler: Literal["on_frame(frame_envelope)"]
    publish: Literal["publish(result_envelope)"]
    teardown: Literal["teardown()"]


class ModuleManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["module-manifest.v1"]
    module_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    version: str = Field(min_length=1)
    owner: str = Field(min_length=1)
    kind: ModuleKind
    needs: Optional[ModuleNeeds] = None
    requires: Optional[ModuleNeeds] = None
    provides: ModuleProvides
    lifecycle: ModuleLifecycle

    @model_validator(mode="after")
    def _fill_needs_aliases(self) -> "ModuleManifest":
        if self.needs is None and self.requires is None:
            raise ValueError(
                "Manifest must declare needs/provides; requires is accepted as a legacy alias"
            )
        if self.needs is None:
            self.needs = self.requires
        if self.requires is None:
            self.requires = self.needs
        return self


PublishFn = Callable[[ResultEnvelope], None]


class Module(ABC):
    """Base class for every module service."""

    manifest: ModuleManifest

    def __init__(self, publish: Optional[PublishFn] = None) -> None:
        self._publish_fn = publish
        self._config: Dict[str, Any] = {}
        self._result_sequence = 0

    @abstractmethod
    def init(self, config: Dict[str, Any]) -> None:
        """Prepare the module. Called once, before any frame arrives."""

    @abstractmethod
    def on_frame(self, frame: FrameEnvelope) -> Optional[ResultEnvelope]:
        """Process one canonical frame."""

    def publish(self, result: ResultEnvelope) -> None:
        """Emit a result on the module's declared result topic."""
        if self._publish_fn is None:
            raise RuntimeError(
                "%s has no publish callback; construct it with Module(publish=...)"
                % type(self).__name__
            )
        self._publish_fn(result)

    def teardown(self) -> None:
        """Release anything init() acquired. Safe to call more than once."""

    def handle(self, frame: FrameEnvelope) -> Optional[ResultEnvelope]:
        """Run on_frame and publish whatever it returns."""
        result = self.on_frame(frame)
        if result is not None:
            self.publish(result)
        return result

    def make_result(
        self,
        frame: FrameEnvelope,
        verdict: str,
        payload: Optional[Dict[str, Any]] = None,
        confidence: Optional[float] = None,
        latency_ms: float = 0.0,
        model: Optional[Dict[str, Any]] = None,
        error: Optional[Dict[str, Any]] = None,
    ) -> ResultEnvelope:
        """Build a valid result envelope correlated to frame."""
        from .result_envelope import utc_now

        self._result_sequence += 1
        return ResultEnvelope(
            schema_version="result-envelope.v1",
            result_id="%s-result-%06d" % (self.manifest.module_id, self._result_sequence),
            frame_id=frame.frame_id,
            source_topic=frame.source_topic,
            result_topic=self.manifest.provides.result_topics[0],
            module_id=self.manifest.module_id,
            verdict=verdict,
            confidence=confidence,
            latency_ms=latency_ms,
            model=model,
            payload=payload or {},
            error=error,
            timestamp_utc=utc_now(),
        )

    @property
    def config(self) -> Dict[str, Any]:
        return self._config


__all__ = [
    "SCHEMA_VERSION",
    "MODULE_LIFECYCLE_NAMES",
    "Module",
    "ModuleManifest",
    "ModuleNeeds",
    "ModuleRequires",
    "ModuleProvides",
    "ModuleLifecycle",
    "UiPanel",
]
