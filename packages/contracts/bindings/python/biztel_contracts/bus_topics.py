"""Bus topic naming convention.

Owner: Samarth (the rule itself). This module is the Python *binding* of that
rule -- it must accept and reject exactly what ``src/bus-topics.js`` does.

Targets Python 3.8; see LANGUAGES.md section 3.
"""
import re
from typing import List

TOPIC_FAMILIES = ("camera", "result", "control", "event", "health")

_FAMILY = "|".join(TOPIC_FAMILIES)
_TOPIC_RE = re.compile(r"^(%s)\.[a-z0-9][a-z0-9_.\-]*$" % _FAMILY)
_PREFIX_RE = re.compile(r"^(%s)(\.[a-z0-9][a-z0-9_.\-]*)?$" % _FAMILY)


class TopicError(ValueError):
    """Raised when a topic or subscription pattern is malformed."""


def is_topic(topic: str) -> bool:
    """True if ``topic`` is a concrete, publishable topic."""
    return isinstance(topic, str) and _TOPIC_RE.match(topic) is not None


def assert_topic(topic: str) -> str:
    if not is_topic(topic):
        raise TopicError(
            "Topic must be family.name, for example camera.line1 or "
            "result.ai-supervisor (got %r)" % (topic,)
        )
    return topic


def is_topic_pattern(pattern: str) -> bool:
    """True if ``pattern`` is a valid subscription pattern.

    A pattern is either an exact topic (``camera.line1``) or a topic prefix
    followed by a trailing wildcard segment (``result.*``, ``event.service.*``).
    """
    if not isinstance(pattern, str):
        return False
    if pattern.endswith(".*"):
        return _PREFIX_RE.match(pattern[:-2]) is not None
    return is_topic(pattern)


def assert_topic_pattern(pattern: str) -> str:
    if not is_topic_pattern(pattern):
        raise TopicError(
            "Pattern must be an exact topic (camera.line1) or a prefix "
            "wildcard (result.*) (got %r)" % (pattern,)
        )
    return pattern


def topic_family(topic: str) -> str:
    return assert_topic(topic).split(".")[0]


def topic_matches(pattern: str, topic: str) -> bool:
    """Whether ``topic`` is delivered to a subscriber listening on ``pattern``."""
    if pattern.endswith(".*"):
        prefix = pattern[:-2]
        return topic == prefix or topic.startswith(prefix + ".")
    return pattern == topic


def is_camera_topic(topic: str) -> bool:
    return topic_family(topic) == "camera"


def is_result_topic(topic: str) -> bool:
    return topic_family(topic) == "result"


CANONICAL_TOPICS = {
    "camera_line1": "camera.line1",
    "result_ai_supervisor": "result.ai-supervisor",
    "result_image_inspection": "result.image-inspection",
    "result_ocr": "result.ocr",
    "event_service_registered": "event.service.registered",
    "event_service_unhealthy": "event.service.unhealthy",
    "control_shutdown": "control.shutdown",
    "health_heartbeat": "health.heartbeat",
}

__all__: List[str] = [
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
]
