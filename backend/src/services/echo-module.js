import { frameEnvelopeSchema, resultEnvelopeSchema } from "@biztel/contracts";

export const echoManifest = Object.freeze({
  schema_version: "module-manifest.v1",
  module_id: "echo",
  display_name: "Echo Module",
  version: "0.1.0",
  owner: "Vision Intel Platform",
  kind: "logic",
  needs: {
    input_topics: ["camera.line1"],
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

/**
 * The Tier 1 canned-result module. It knows its input and output topics and
 * nothing else — no other service's identity, no core internals.
 */
export function createEchoModule({ bus, manifest = echoManifest }) {
  const inputTopic = manifest.needs.input_topics[0];
  const resultTopic = manifest.provides.result_topics[0];

  let unsubscribe = null;
  let sequence = 0;

  const module = {
    manifest,

    init() {
      unsubscribe = bus.subscribe(manifest.module_id, inputTopic, (payload) =>
        module.on_frame(payload)
      );
      return module;
    },

    on_frame(framePayload) {
      const startedAt = Date.now();
      const frame = frameEnvelopeSchema.parse(framePayload);
      sequence += 1;

      const result = resultEnvelopeSchema.parse({
        schema_version: "result-envelope.v1",
        result_id: `echo-result-${String(sequence).padStart(6, "0")}`,
        frame_id: frame.frame_id,
        source_topic: frame.source_topic,
        result_topic: resultTopic,
        module_id: manifest.module_id,
        verdict: "pass",
        confidence: 1,
        latency_ms: Date.now() - startedAt,
        payload: {
          echo: true,
          observed_sequence: frame.sequence,
          pixel_format: frame.format.pixel_format
        },
        timestamp_utc: new Date().toISOString()
      });

      module.publish(result);
      return result;
    },

    publish(result) {
      bus.publish({ topic: result.result_topic, payload: result });
    },

    teardown() {
      unsubscribe?.();
      unsubscribe = null;
    }
  };

  return module;
}
