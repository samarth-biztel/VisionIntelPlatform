import { canonicalTopics } from "@biztel/contracts";
import { createEchoModule, echoManifest } from "./services/echo-module.js";
import { createLogSink } from "./services/log-sink.js";
import { createMockSource } from "./services/mock-source.js";

/**
 * Boots the Tier 1 skeleton loop: mock source -> echo module -> log sink.
 * Everything below talks over the bus by topic only.
 */
export function seedRuntime(registry, bus, config, { verbose = true } = {}) {
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

  registry.registerService({
    schema_version: "service-registration.v1",
    service_id: "log-sink",
    display_name: "Log Sink",
    role: "sink",
    version: "0.1.0",
    host_id: config.device.device_id,
    subscribes: ["result.*"],
    publishes: [],
    started_at_utc: now,
    metadata: {}
  });

  registry.heartbeat({
    schema_version: "service-heartbeat.v1",
    service_id: "log-sink",
    state: "running",
    timestamp_utc: now,
    uptime_ms: 0,
    metrics: {}
  });

  registry.registerModule(echoManifest);

  registry.registerService({
    schema_version: "service-registration.v1",
    service_id: "echo",
    display_name: "Echo Module",
    role: "module",
    version: "0.1.0",
    host_id: config.device.device_id,
    subscribes: echoManifest.requires.input_topics,
    publishes: echoManifest.provides.result_topics,
    started_at_utc: now,
    metadata: {}
  });

  registry.heartbeat({
    schema_version: "service-heartbeat.v1",
    service_id: "echo",
    state: "running",
    timestamp_utc: now,
    uptime_ms: 0,
    metrics: {}
  });

  const source = createMockSource({ bus });
  const echo = createEchoModule({ bus }).init();
  const logSink = createLogSink({ bus, verbose }).init();

  bus.publish({
    topic: canonicalTopics.eventServiceRegistered,
    payload: {
      service_id: "core"
    }
  });

  return { source, echo, logSink };
}
