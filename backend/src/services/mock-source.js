import { createMockFrame } from "@biztel/contracts";

/**
 * Tier 1 synthetic source: capture -> normalize -> publish, with the capture
 * step faked. Publishes an already-canonical frame envelope, exactly as a real
 * camera source would.
 */
export function createMockSource({
  bus,
  sourceId = "mock-source",
  topic = "camera.line1",
  targetFormat = "bgr_1080p"
}) {
  let sequence = 0;
  let timer = null;

  const source = {
    source_id: sourceId,
    topic,

    captureOnce() {
      sequence += 1;
      const frame = createMockFrame({
        frame_id: `${sourceId}-${String(sequence).padStart(6, "0")}`,
        timestamp_utc: new Date().toISOString(),
        source_topic: topic,
        source_id: sourceId,
        sequence,
        calibration: {
          calibration_id: "line1-default",
          target_format: targetFormat
        },
        payload: {
          transport: "inline_mock",
          ref: `synthetic://${topic}/frame/${sequence}`
        }
      });

      bus.publish({ topic, payload: frame });
      return frame;
    },

    start(intervalMs) {
      if (timer || !intervalMs) {
        return source;
      }
      timer = setInterval(() => source.captureOnce(), intervalMs);
      timer.unref?.();
      return source;
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };

  return source;
}
