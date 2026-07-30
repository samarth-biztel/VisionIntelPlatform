import { canonicalTopics } from "@biztel/contracts";
import { createEchoModule, echoManifest } from "./services/echo-module.js";
import { createLogSink } from "./services/log-sink.js";
import { createMockSource } from "./services/mock-source.js";

const HEARTBEAT_INTERVAL_MS = 10_000;

function registerRunningService(registry, registration, metrics = {}) {
  const startedAt = Date.parse(registration.started_at_utc);
  registry.registerService(registration);

  const beat = () => {
    const current = registry.getService(registration.service_id);
    if (current?.state === "stopped") {
      return current;
    }
    return registry.heartbeat({
      schema_version: "service-heartbeat.v1",
      service_id: registration.service_id,
      state: "running",
      timestamp_utc: new Date().toISOString(),
      uptime_ms: Math.max(0, Date.now() - startedAt),
      metrics
    });
  };

  beat();
  return beat;
}

function startHeartbeatLoop(registry, bus, beats) {
  const publishBeat = (beat) => {
    const service = beat();
    bus.publish({ topic: service.health_topic, payload: service.last_heartbeat });
  };

  const timer = setInterval(() => {
    for (const beat of beats) {
      publishBeat(beat);
    }
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref?.();

  return {
    interval_ms: HEARTBEAT_INTERVAL_MS,
    beatNow() {
      for (const beat of beats) {
        publishBeat(beat);
      }
    },
    stop() {
      clearInterval(timer);
    }
  };
}

/**
 * Boots the Tier 1 skeleton loop: mock source -> echo module -> log sink.
 * Everything below talks over the bus by topic only.
 */
export function seedRuntime(registry, bus, config, { verbose = true } = {}) {
  const now = new Date().toISOString();
  const beats = [];

  beats.push(
    registerRunningService(
      registry,
      {
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
      },
      { pid: process.pid }
    )
  );

  beats.push(
    registerRunningService(
      registry,
      {
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
      },
      { fps: 30 }
    )
  );

  beats.push(
    registerRunningService(registry, {
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
    })
  );

  registry.registerModule(echoManifest);

  beats.push(
    registerRunningService(registry, {
      schema_version: "service-registration.v1",
      service_id: "echo",
      display_name: "Echo Module",
      role: "module",
      version: "0.1.0",
      host_id: config.device.device_id,
      subscribes: echoManifest.needs.input_topics,
      publishes: echoManifest.provides.result_topics,
      started_at_utc: now,
      metadata: {}
    })
  );

  const source = createMockSource({ bus });
  const echo = createEchoModule({ bus }).init();
  const logSink = createLogSink({ bus, verbose }).init();
  const heartbeats = startHeartbeatLoop(registry, bus, beats);

  bus.publish({
    topic: canonicalTopics.eventServiceRegistered,
    payload: {
      service_id: "core"
    }
  });

  return { source, echo, logSink, heartbeats };
}


