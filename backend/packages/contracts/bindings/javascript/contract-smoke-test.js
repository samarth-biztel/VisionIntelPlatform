import assert from "node:assert/strict";
import {
  canonicalTopics,
  createMockFrame,
  heartbeatSchema,
  moduleManifestSchema,
  resultEnvelopeSchema,
  serviceRegistrationSchema,
  topicMatches,
  topicPatternSchema
} from "./index.js";

const now = new Date().toISOString();
const frame = createMockFrame();

// Topic pattern matching — the rule the bus fans messages out by.
assert.equal(topicMatches("result.*", "result.echo"), true);
assert.equal(topicMatches("result.*", "camera.line1"), false);
assert.equal(topicMatches("result.*", "resultx.echo"), false, "must not match a longer family");
assert.equal(topicMatches("camera.line1", "camera.line10"), false, "must not prefix-match");
assert.equal(topicMatches("event.service.*", "event.service.registered"), true);
assert.equal(topicMatches("event.service.*", "event.other.thing"), false);

assert.equal(topicPatternSchema.safeParse("result.*").success, true);
assert.equal(topicPatternSchema.safeParse("camera.line1").success, true);
assert.equal(topicPatternSchema.safeParse("*").success, false, "bare wildcard is not a pattern");
assert.equal(topicPatternSchema.safeParse("bogus.*").success, false, "family must be known");

// A sink subscribes by wildcard but publishes nothing; a wildcard publish is invalid.
serviceRegistrationSchema.parse({
  schema_version: "service-registration.v1",
  service_id: "log-sink",
  display_name: "Log Sink",
  role: "sink",
  version: "0.1.0",
  host_id: "dev-workstation",
  subscribes: ["result.*"],
  publishes: [],
  started_at_utc: now
});

assert.throws(
  () =>
    serviceRegistrationSchema.parse({
      schema_version: "service-registration.v1",
      service_id: "bad-publisher",
      display_name: "Bad Publisher",
      role: "sink",
      version: "0.1.0",
      host_id: "dev-workstation",
      publishes: ["result.*"],
      started_at_utc: now
    }),
  "publishing to a wildcard topic must be rejected"
);

serviceRegistrationSchema.parse({
  schema_version: "service-registration.v1",
  service_id: "core",
  display_name: "Core Supervisor",
  role: "core",
  version: "0.1.0",
  host_id: "dev-workstation",
  subscribes: [canonicalTopics.healthHeartbeat],
  publishes: [canonicalTopics.eventServiceRegistered],
  started_at_utc: now,
  metadata: {}
});

heartbeatSchema.parse({
  schema_version: "service-heartbeat.v1",
  service_id: "core",
  state: "running",
  timestamp_utc: now,
  uptime_ms: 1,
  metrics: {}
});

moduleManifestSchema.parse({
  schema_version: "module-manifest.v1",
  module_id: "echo",
  display_name: "Echo Module",
  version: "0.1.0",
  owner: "Samarth",
  kind: "logic",
  requires: {
    input_topics: [canonicalTopics.cameraLine1],
    models: [],
    config_keys: [],
    services: []
  },
  provides: {
    result_topics: ["result.echo"],
    ui_panel: {
      route: "/modules/echo",
      mount_slot: "dashboard"
    }
  },
  lifecycle: {
    init: "init(config)",
    frame_handler: "on_frame(frame_envelope)",
    publish: "publish(result_envelope)",
    teardown: "teardown()"
  }
});

resultEnvelopeSchema.parse({
  schema_version: "result-envelope.v1",
  result_id: "mock-result-000001",
  frame_id: frame.frame_id,
  source_topic: frame.source_topic,
  result_topic: "result.echo",
  module_id: "echo",
  verdict: "pass",
  confidence: 1,
  latency_ms: 3,
  payload: {
    echo: true
  },
  timestamp_utc: now
});

console.log("contracts: ok");
