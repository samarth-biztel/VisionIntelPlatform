/**
 * Tier 1 conformance test: mock source -> echo module -> log sink.
 *
 * Proves the role split holds with no hardware and no models attached:
 * frames are delivered by topic, a module turns one into a valid result
 * envelope, a sink receives it by wildcard, and a failing subscriber is
 * contained instead of taking the bus down.
 */
import assert from "node:assert/strict";
import { InMemoryBus } from "./in-memory-bus.js";
import { ServiceRegistry } from "./registry.js";
import { seedRuntime } from "./seed-runtime.js";
import { NotFoundError } from "./errors.js";
import { checkPlatformDependencies } from "./dependency-checker.js";

const config = {
  device: { device_id: "test-box", bus: { mode: "in-memory" }, runs: ["core"] },
  site: { site_id: "test-site", enabled_modules: ["echo"], sources: {}, sinks: {} },
  loaded_from: { device: "test", site: "test" }
};

const registry = new ServiceRegistry();
const bus = new InMemoryBus();
const runtime = seedRuntime(registry, bus, config, { verbose: false });
const { source, logSink } = runtime;

// One frame in, one result out, correlated by frame_id.
const frame = source.captureOnce();
assert.equal(logSink.count, 1, "one capture must yield one result at the sink");

const [entry] = logSink.recent(1);
assert.equal(entry.topic, "result.echo");
assert.equal(entry.payload.frame_id, frame.frame_id, "result must trace back to its frame");
assert.equal(entry.payload.source_topic, frame.source_topic);
assert.equal(entry.payload.verdict, "pass");

// A slow/broken subscriber must not block or break the others.
bus.subscribe("exploding-sink", "result.*", () => {
  throw new Error("boom");
});
source.captureOnce();
assert.equal(logSink.count, 2, "a throwing subscriber must not stop delivery to healthy ones");

// A malformed frame is rejected by the module, not by the bus.
bus.publish({ topic: "camera.line1", payload: { garbage: true } });
assert.equal(logSink.count, 2, "an invalid frame must not produce a result");

// The bus keeps working afterwards.
source.captureOnce();
assert.equal(logSink.count, 3, "the loop must survive a subscriber failure");

// Sinks never learn who produced a result, only the topic.
assert.equal(
  bus.snapshot().subscribers.find((s) => s.service_id === "log-sink").topics[0],
  "result.*"
);

// Heartbeat for an unregistered service is a 404-shaped error, not a crash.
assert.throws(
  () =>
    registry.heartbeat({
      schema_version: "service-heartbeat.v1",
      service_id: "ghost",
      state: "running",
      timestamp_utc: new Date().toISOString(),
      uptime_ms: 0
    }),
  NotFoundError
);

const dependencyReport = checkPlatformDependencies({ registry, config });
assert.equal(dependencyReport.ok, true, "seed runtime dependencies must pass");
assert.equal(dependencyReport.modules.find((module) => module.module_id === "echo").ready, true);

console.log("tier1 loop: ok");