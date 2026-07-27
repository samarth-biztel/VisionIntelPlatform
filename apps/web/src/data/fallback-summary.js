export const fallbackSummary = {
  registry: {
    service_count: 2,
    module_count: 1,
    healthy_count: 2,
    degraded_count: 0,
    error_count: 0
  },
  config: {
    device_id: "dev-workstation",
    site_id: "biztel-lab",
    enabled_modules: ["echo"]
  },
  bus: {
    mode: "in-memory",
    retained_messages: 1,
    subscribers: [
      {
        service_id: "echo",
        topics: ["camera.line1"]
      },
      {
        service_id: "log-sink",
        topics: ["result.*"]
      }
    ],
    recent_messages: [
      {
        id: "local-1",
        topic: "event.service.registered",
        family: "event",
        timestamp_utc: new Date().toISOString()
      }
    ]
  },
  samarth_queue: [
    "Bus topic naming convention",
    "Service interface",
    "Core registry and health loop",
    "Config loader",
    "Operator dashboard shell"
  ]
};
