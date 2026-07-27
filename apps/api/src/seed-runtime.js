import { canonicalTopics } from "@biztel/contracts";

export function seedRuntime(registry, bus, config) {
  const now = new Date().toISOString();

  registry.registerService({
    schema_version: "service-registration.v1",
    service_id: "core",
    display_name: "Core Supervisor",
    role: "core",
    version: "0.1.0",
    host_id: config.device.device_id,
    process_id: process.pid,
    subscribes: [canonicalTopics.healthHeartbeat],
    publishes: [canonicalTopics.eventServiceRegistered, canonicalTopics.eventServiceUnhealthy],
    started_at_utc: now,
    metadata: {
      stack: "express",
      bus_mode: config.device.bus?.mode ?? "in-memory"
    }
  });

  registry.heartbeat({
    schema_version: "service-heartbeat.v1",
    service_id: "core",
    state: "running",
    timestamp_utc: now,
    uptime_ms: 0,
    metrics: {
      pid: process.pid
    }
  });

  registry.registerService({
    schema_version: "service-registration.v1",
    service_id: "mock-source",
    display_name: "Mock Camera Source",
    role: "source",
    version: "0.1.0",
    host_id: config.device.device_id,
    subscribes: [],
    publishes: [canonicalTopics.cameraLine1],
    started_at_utc: now,
    metadata: {
      target_format: "bgr_1080p"
    }
  });

  registry.heartbeat({
    schema_version: "service-heartbeat.v1",
    service_id: "mock-source",
    state: "running",
    timestamp_utc: now,
    uptime_ms: 0,
    metrics: {
      fps: 30
    }
  });

  registry.registerModule({
    schema_version: "module-manifest.v1",
    module_id: "echo",
    display_name: "Echo Module",
    version: "0.1.0",
    owner: "Samarth",
    kind: "logic",
    requires: {
      input_topics: [canonicalTopics.cameraLine1],
      models: [],
      config_keys: ["site.enabled_modules"],
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

  bus.subscribe("echo", canonicalTopics.cameraLine1);
  bus.subscribe("log-sink", "result.*");
  bus.publish({
    topic: canonicalTopics.eventServiceRegistered,
    payload: {
      service_id: "core"
    }
  });
}
