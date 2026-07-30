export const fallbackSummary = {
  registry: {
    service_count: 3,
    module_count: 1,
    healthy_count: 3,
    degraded_count: 0,
    error_count: 0,
    stopped_count: 0
  },
  services: [
    {
      service_id: "core",
      display_name: "Core Supervisor",
      role: "core",
      state: "running",
      alive: true,
      heartbeat_status: "fresh"
    },
    {
      service_id: "mock-source",
      display_name: "Mock Camera Source",
      role: "source",
      state: "running",
      alive: true,
      heartbeat_status: "fresh"
    },
    {
      service_id: "echo",
      display_name: "Echo Module",
      role: "module",
      state: "running",
      alive: true,
      heartbeat_status: "fresh"
    }
  ],
  modules: [
    {
      module_id: "echo",
      display_name: "Echo Module"
    }
  ],
  config: {
    device_id: "dev-workstation",
    site_id: "biztel-lab",
    enabled_modules: ["echo"]
  },
  bus: {
    mode: "in-memory",
    retained_messages: 1,
    subscriber_count: 2,
    subscribers: [
      {
        service_id: "echo",
        topics: ["camera.line1"],
        delivered: 0,
        failed: 0
      },
      {
        service_id: "log-sink",
        topics: ["result.*"],
        delivered: 0,
        failed: 0
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
  lifecycle: {
    startup: {
      order: [
        { service_id: "core", role: "core", state: "running", alive: true },
        { service_id: "mock-source", role: "source", state: "running", alive: true },
        { service_id: "echo", role: "module", state: "running", alive: true },
        { service_id: "log-sink", role: "sink", state: "running", alive: true }
      ],
      modules: [
        {
          module_id: "echo",
          display_name: "Echo Module",
          ready: true,
          missing_services: [],
          missing_input_topics: []
        }
      ]
    },
    shutdown: []
  },
  samarth_queue: [
    "Manifest needs/provides spec",
    "Publish/subscribe bus",
    "Service registration",
    "Heartbeat alive-check",
    "Startup/shutdown sequencing"
  ]
};
