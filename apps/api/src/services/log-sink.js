/**
 * Tier 1 sink: subscribes to result topics and acts (here: records + prints).
 * It never knows which module produced the result — only the topic family.
 */
export function createLogSink({
  bus,
  sinkId = "log-sink",
  patterns = ["result.*"],
  limit = 50,
  verbose = true
}) {
  const entries = [];
  const unsubscribers = [];

  const sink = {
    sink_id: sinkId,

    init() {
      for (const pattern of patterns) {
        unsubscribers.push(
          bus.subscribe(sinkId, pattern, (payload, envelope) => {
            entries.unshift({
              topic: envelope.topic,
              received_at_utc: envelope.timestamp_utc,
              payload
            });
            entries.splice(limit);

            if (verbose) {
              console.log(
                `log-sink: ${envelope.topic} ${payload?.module_id ?? ""} ${payload?.verdict ?? ""}`.trimEnd()
              );
            }
          })
        );
      }
      return sink;
    },

    recent(count = 10) {
      return entries.slice(0, count);
    },

    get count() {
      return entries.length;
    },

    teardown() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      unsubscribers.length = 0;
    }
  };

  return sink;
}
