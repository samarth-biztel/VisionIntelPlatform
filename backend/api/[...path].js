const NOW = "2026-07-31T00:00:00.000Z";

const TOPICS = [
  "camera.line1",
  "result.echo",
  "event.service.registered",
  "health.heartbeat"
];

function heartbeat(serviceId, state = "running", message = null) {
  return {
    schema_version: "service-heartbeat.v1",
    service_id: serviceId,
    state,
    timestamp_utc: NOW,
    uptime_ms: 1,
    message,
    metrics: {}
  };
}

function service(service_id, display_name, role, publishes, subscribes) {
  return {
    schema_version: "service-registration.v1",
    service_id,
    display_name,
    role,
    version: "0.1.0",
    host_id: "dev-workstation",
    subscribes,
    publishes,
    health_topic: "health.heartbeat",
    started_at_utc: NOW,
    metadata: {},
    state: "running",
    stopped_reason: null,
    last_heartbeat: heartbeat(service_id),
    alive: true,
    heartbeat_status: "fresh",
    heartbeat_age_ms: 0,
    heartbeat_stale_after_ms: 30000
  };
}

function echoManifest() {
  return {
    schema_version: "module-manifest.v1",
    module_id: "echo",
    display_name: "Echo Module",
    version: "0.1.0",
    owner: "Samarth",
    kind: "logic",
    needs: {
      input_topics: ["camera.line1"],
      models: [],
      config_keys: ["site.enabled_modules"],
      services: []
    },
    requires: {
      input_topics: ["camera.line1"],
      models: [],
      config_keys: ["site.enabled_modules"],
      services: []
    },
    provides: { result_topics: ["result.echo"] },
    lifecycle: {
      init: "init(config)",
      frame_handler: "on_frame(frame_envelope)",
      publish: "publish(result_envelope)",
      teardown: "teardown()"
    }
  };
}

function initialState() {
  return {
    config: {
      device: {
        device_id: "dev-workstation",
        role: "development",
        runs: ["core"],
        bus: { mode: "in-memory", host: "localhost", port: 7080 }
      },
      site: {
        site_id: "biztel-lab",
        enabled_modules: [],
        sources: {},
        sinks: {}
      },
      loaded_from: { device: "defaults", site: "defaults" }
    },
    services: {
      core: service("core", "Core Supervisor", "core", ["event.service.registered"], ["health.heartbeat"]),
      "mock-source": service("mock-source", "Mock Camera Source", "source", ["camera.line1"], []),
      echo: service("echo", "Echo Module", "module", ["result.echo"], ["camera.line1"]),
      "log-sink": service("log-sink", "Log Sink", "sink", [], ["result.*"])
    },
    modules: { echo: echoManifest() },
    messages: [],
    subscribers: [
      { service_id: "echo", topics: ["camera.line1"], delivered: 0, failed: 0 },
      { service_id: "log-sink", topics: ["result.*"], delivered: 0, failed: 0 }
    ],
    frame_sequence: 0,
    sink_entries: []
  };
}

function state() {
  globalThis.__visionIntelState ||= initialState();
  return globalThis.__visionIntelState;
}

function topicFamily(topic) {
  return topic.split(".")[0] || topic;
}

function topicMatches(pattern, topic) {
  if (pattern === topic) return true;
  if (!pattern.endsWith(".*")) return false;
  return topic.startsWith(pattern.slice(0, -1));
}

function publish(runtime, topic, payload) {
  let delivered = 0;
  for (const subscriber of runtime.subscribers) {
    if (subscriber.topics.some((pattern) => topicMatches(pattern, topic))) {
      subscriber.delivered += 1;
      delivered += 1;
    }
  }

  const entry = {
    id: `${runtime.messages.length + 1}-${runtime.frame_sequence}`,
    topic,
    family: topicFamily(topic),
    timestamp_utc: NOW,
    message: { topic, payload },
    delivered_to: delivered
  };
  runtime.messages.unshift(entry);
  runtime.messages = runtime.messages.slice(0, 100);
  return entry;
}

function registrySummary(runtime) {
  const services = Object.values(runtime.services);
  return {
    service_count: services.length,
    module_count: Object.keys(runtime.modules).length,
    healthy_count: services.filter((svc) => svc.state === "running" && svc.alive).length,
    degraded_count: services.filter((svc) => svc.state === "degraded" || svc.heartbeat_status === "stale").length,
    error_count: services.filter((svc) => svc.state === "error").length,
    stopped_count: services.filter((svc) => svc.state === "stopped").length
  };
}

function busSnapshot(runtime) {
  return {
    mode: "in-memory",
    retained_messages: runtime.messages.length,
    subscriber_count: runtime.subscribers.length,
    subscribers: runtime.subscribers,
    recent_messages: runtime.messages.slice(0, 10)
  };
}

function lifecyclePlan(runtime, reverse = false) {
  const order = ["core", "vision_runtime", "source", "module", "sink", "ui"];
  const services = Object.values(runtime.services).sort((a, b) => {
    const left = order.indexOf(a.role);
    const right = order.indexOf(b.role);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
  });
  if (reverse) services.reverse();
  return services.map((svc) => ({
    service_id: svc.service_id,
    display_name: svc.display_name,
    role: svc.role,
    state: svc.state,
    ready: svc.state === "running",
    blocked_by: []
  }));
}

function dependencies(runtime) {
  return {
    ok: true,
    summary: { passed: 5, failed: 0, warning: 0 },
    failed_checks: [],
    modules: Object.values(runtime.modules),
    checks: [
      { id: "device-runs", status: "pass", message: "Configured services are registered" },
      { id: "enabled-modules", status: "pass", message: "Enabled modules have manifests" },
      { id: "module-input-topics", status: "pass", message: "Input topics have publishers" }
    ]
  };
}

function dashboard(runtime) {
  return {
    registry: registrySummary(runtime),
    services: Object.values(runtime.services),
    modules: Object.values(runtime.modules),
    config: {
      device_id: runtime.config.device.device_id,
      site_id: runtime.config.site.site_id,
      enabled_modules: runtime.config.site.enabled_modules,
      loaded_from: runtime.config.loaded_from
    },
    bus: busSnapshot(runtime),
    lifecycle: {
      startup: lifecyclePlan(runtime, false),
      shutdown: lifecyclePlan(runtime, true)
    },
    dependencies: dependencies(runtime),
    platform_scope: [
      "Manifest needs/provides spec",
      "Publish/subscribe bus",
      "Service registration",
      "Heartbeat alive-check",
      "Startup/shutdown sequencing"
    ]
  };
}

function capture(runtime) {
  runtime.frame_sequence += 1;
  const frameId = `mock-frame-${String(runtime.frame_sequence).padStart(6, "0")}`;
  const frame = {
    schema_version: "frame-envelope.v1",
    frame_id: frameId,
    timestamp_utc: NOW,
    source_topic: "camera.line1",
    source_id: "mock-source",
    sequence: runtime.frame_sequence,
    format: {
      pixel_format: "BGR8",
      width: 1920,
      height: 1080,
      channels: 3,
      bit_depth: 8,
      color_space: "BGR"
    },
    calibration: { calibration_id: "line1-default", target_format: "bgr_1080p" },
    payload: { transport: "inline_mock", ref: `synthetic://line1/frame/${String(runtime.frame_sequence).padStart(6, "0")}` },
    metadata: {}
  };
  publish(runtime, "camera.line1", frame);

  const result = {
    schema_version: "result-envelope.v1",
    result_id: `echo-result-${String(runtime.frame_sequence).padStart(6, "0")}`,
    frame_id: frameId,
    source_topic: "camera.line1",
    result_topic: "result.echo",
    module_id: "echo",
    verdict: "pass",
    confidence: 1,
    latency_ms: 1,
    payload: { echo: true },
    timestamp_utc: NOW
  };
  publish(runtime, "result.echo", result);
  runtime.sink_entries.unshift(result);
  return { frame_id: frameId, topic: "camera.line1", results: runtime.sink_entries.slice(0, 1) };
}

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  const runtime = state();
  const path = new URL(req.url, "https://backend.local").pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") return json(res, 204, {});

  switch (`${method} ${path}`) {
    case "GET /api/health":
      return json(res, 200, { status: "ok", service: "core", timestamp_utc: NOW });
    case "GET /api/config":
      return json(res, 200, runtime.config);
    case "GET /api/contracts":
      return json(res, 200, {
        tier0: [
          "frame-envelope.v1",
          "result-envelope.v1",
          "service-registration.v1",
          "service-heartbeat.v1",
          "module-manifest.v1",
          "service-shutdown.v1"
        ],
        topics: TOPICS
      });
    case "GET /api/dashboard-summary":
      return json(res, 200, dashboard(runtime));
    case "GET /api/services":
      return json(res, 200, { services: Object.values(runtime.services) });
    case "GET /api/modules":
      return json(res, 200, { modules: Object.values(runtime.modules) });
    case "GET /api/dependencies":
      return json(res, 200, dependencies(runtime));
    case "GET /api/lifecycle/startup-plan":
      return json(res, 200, lifecyclePlan(runtime, false));
    case "GET /api/lifecycle/shutdown-plan":
      return json(res, 200, { services: lifecyclePlan(runtime, true) });
    case "POST /api/lifecycle/startup":
      for (const svc of Object.values(runtime.services)) {
        svc.state = "running";
        svc.alive = true;
        svc.stopped_reason = null;
      }
      return json(res, 202, { services: lifecyclePlan(runtime, false) });
    case "POST /api/lifecycle/shutdown":
      for (const svc of Object.values(runtime.services)) {
        svc.state = "stopped";
        svc.alive = false;
        svc.stopped_reason = "operator request";
      }
      return json(res, 202, { services: lifecyclePlan(runtime, true) });
    case "POST /api/source/capture":
      return json(res, 202, capture(runtime));
    case "GET /api/sink/log":
      return json(res, 200, { sink_id: "log-sink", count: runtime.sink_entries.length, entries: runtime.sink_entries.slice(0, 10) });
    case "GET /api/bus":
      return json(res, 200, busSnapshot(runtime));
    case "GET /api/bus/messages":
      return json(res, 200, { messages: runtime.messages.slice(0, 25) });
    case "GET /api/bus/subscriptions":
      return json(res, 200, { subscriptions: runtime.subscribers });
    case "POST /api/bus/publish":
      return json(res, 202, { message: publish(runtime, "event.service.registered", {}) });
    case "POST /api/validate/frame":
    case "POST /api/validate/result":
      return json(res, 200, { ok: true });
    default:
      if (method === "POST" && path.startsWith("/api/services/") && path.endsWith("/shutdown")) {
        return json(res, 200, { service: null, shutdown_plan: lifecyclePlan(runtime, true) });
      }
      return json(res, 404, { error: "not_found" });
  }
};
