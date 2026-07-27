import {
  canonicalTopics,
  createMockFrame,
  heartbeatSchema,
  moduleManifestSchema,
  resultEnvelopeSchema,
  serviceRegistrationSchema
} from "./index.js";

const now = new Date().toISOString();
const frame = createMockFrame();

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
