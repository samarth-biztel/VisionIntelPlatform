"""Python binding conformance test.

Runs the shared corpus in ``packages/contracts/fixtures/conformance.json``.
Every other binding runs that same file. If two bindings ever disagree on a
case, one of them fails its build -- the point (PROBLEM_STATEMENT.md S8, P11).

Run: python packages/contracts/bindings/python/conformance_test.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from biztel_contracts import (  # noqa: E402
    FrameEnvelope,
    InferenceRequest,
    InferenceResponse,
    Module,
    ModuleManifest,
    ResultEnvelope,
    ServiceHeartbeat,
    ServiceRegistration,
    ShutdownCommand,
    create_mock_frame,
    is_topic,
    is_topic_pattern,
    topic_matches,
)

# bindings/python -> packages/contracts
CONTRACTS_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
FIXTURES = os.path.join(CONTRACTS_ROOT, "fixtures", "conformance.json")

MODELS = {
    "frame_envelope": FrameEnvelope,
    "result_envelope": ResultEnvelope,
    "module_manifest": ModuleManifest,
    "inference_request": InferenceRequest,
    "inference_response": InferenceResponse,
    "service_registration": ServiceRegistration,
    "service_heartbeat": ServiceHeartbeat,
    "service_shutdown": ShutdownCommand,
}

failures = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        failures.append(message)


def strip_meta(case):
    return {key: value for key, value in case.items() if not key.startswith("_")}


with open(FIXTURES) as handle:
    corpus = json.load(handle)

# -- schema cases --------------------------------------------------------

for group, model in MODELS.items():
    section = corpus[group]

    for case in section["valid"]:
        name = case.get("_name", "?")
        try:
            model(**strip_meta(case))
        except Exception as error:  # noqa: BLE001
            check(False, "%s: valid case %r was rejected: %s" % (group, name, error))
        else:
            check(True, "")

    for case in section["invalid"]:
        name = case.get("_name", "?")
        try:
            model(**strip_meta(case))
        except Exception:  # noqa: BLE001
            check(True, "")
        else:
            check(False, "%s: invalid case %r was ACCEPTED" % (group, name))

# -- round-trip cases ----------------------------------------------------
#
# Parse, re-serialize to JSON, and require every original value to come back
# byte-identical. Bindings may add defaults; they may not alter what was sent.


def subset_equal(expected, actual, path=""):
    """Every key/value in ``expected`` must appear identically in ``actual``."""
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return ["%s: expected object, got %r" % (path, type(actual).__name__)]
        problems = []
        for key, value in expected.items():
            if key not in actual:
                problems.append("%s.%s: missing after round trip" % (path, key))
            else:
                problems += subset_equal(value, actual[key], "%s.%s" % (path, key))
        return problems
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return ["%s: list changed shape" % path]
        problems = []
        for index, value in enumerate(expected):
            problems += subset_equal(value, actual[index], "%s[%d]" % (path, index))
        return problems
    # bool must stay bool: in Python True == 1 and True == 1.0, so compare types too.
    if isinstance(expected, bool) or isinstance(actual, bool):
        if type(expected) is not type(actual) or expected != actual:
            return [
                "%s: %r (%s) became %r (%s)"
                % (path, expected, type(expected).__name__, actual, type(actual).__name__)
            ]
        return []
    if expected != actual:
        return ["%s: %r became %r" % (path, expected, actual)]
    return []


for case in corpus["round_trip"]:
    name = case.get("_name", "?")
    model = MODELS[case["group"]]
    original = case["message"]
    parsed = model(**original)
    reserialized = json.loads(parsed.model_dump_json())
    problems = subset_equal(original, reserialized, case["group"])
    check(not problems, "round trip %r: %s" % (name, "; ".join(problems)))

# -- topic cases ---------------------------------------------------------

topics = corpus["topics"]

for topic in topics["valid_topics"]:
    check(is_topic(topic), "topic %r should be valid" % (topic,))

for topic in topics["invalid_topics"]:
    check(not is_topic(topic), "topic %r should be invalid" % (topic,))

for pattern in topics["valid_patterns"]:
    check(is_topic_pattern(pattern), "pattern %r should be valid" % (pattern,))

for pattern in topics["invalid_patterns"]:
    check(not is_topic_pattern(pattern), "pattern %r should be invalid" % (pattern,))

for pattern, topic, expected in topics["matches"]:
    actual = topic_matches(pattern, topic)
    check(
        actual == expected,
        "topic_matches(%r, %r) = %s, expected %s" % (pattern, topic, actual, expected),
    )

# -- module base class ---------------------------------------------------

manifest = ModuleManifest(**strip_meta(corpus["module_manifest"]["valid"][0]))
published = []


class _Echo(Module):
    def init(self, config):
        self._config = config

    def on_frame(self, frame):
        return self.make_result(frame, verdict="pass", payload={"echo": True})


echo = _Echo(publish=published.append)
echo.manifest = manifest
echo.init({"threshold": 1})

frame = create_mock_frame()
result = echo.handle(frame)

check(len(published) == 1, "handle() should publish exactly one result")
check(result.frame_id == frame.frame_id, "result must correlate to its frame")
check(result.source_topic == frame.source_topic, "result must carry the source topic")
check(result.result_topic == "result.echo", "result must use the manifest's result topic")
check(result.module_id == "echo", "result must carry the module id")
check(result.verdict == "pass", "verdict should round-trip")

# A module returning None publishes nothing.
class _Silent(Module):
    def init(self, config):
        pass

    def on_frame(self, frame):
        return None


silent = _Silent(publish=published.append)
silent.manifest = manifest
check(silent.handle(frame) is None, "returning None must publish nothing")
check(len(published) == 1, "silent module must not have published")

# A module with no publish callback fails loudly rather than silently dropping.
orphan = _Echo()
orphan.manifest = manifest
try:
    orphan.handle(frame)
except RuntimeError:
    check(True, "")
else:
    check(False, "a module with no publish callback should raise")

# The mock frame is itself valid, and round-trips through JSON.
check(
    FrameEnvelope(**json.loads(frame.model_dump_json())).frame_id == frame.frame_id,
    "mock frame must survive a JSON round trip",
)

# -- report --------------------------------------------------------------

if failures:
    print("python contracts: %d FAILURES of %d checks" % (len(failures), checks))
    for failure in failures:
        print("  -", failure)
    sys.exit(1)

print("python contracts: ok (%d checks)" % checks)
