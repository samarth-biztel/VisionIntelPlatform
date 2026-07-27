import {
  heartbeatSchema,
  moduleManifestSchema,
  serviceRegistrationSchema
} from "@biztel/contracts";

export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.modules = new Map();
  }

  registerService(payload) {
    const registration = serviceRegistrationSchema.parse(payload);
    const previous = this.services.get(registration.service_id);
    const record = {
      ...registration,
      last_heartbeat: previous?.last_heartbeat ?? null,
      state: previous?.state ?? "starting"
    };
    this.services.set(registration.service_id, record);
    return record;
  }

  heartbeat(payload) {
    const heartbeat = heartbeatSchema.parse(payload);
    const current = this.services.get(heartbeat.service_id);
    if (!current) {
      throw new Error(`Unknown service: ${heartbeat.service_id}`);
    }
    const record = {
      ...current,
      state: heartbeat.state,
      last_heartbeat: heartbeat
    };
    this.services.set(heartbeat.service_id, record);
    return record;
  }

  registerModule(payload) {
    const manifest = moduleManifestSchema.parse(payload);
    this.modules.set(manifest.module_id, manifest);
    return manifest;
  }

  listServices() {
    return [...this.services.values()];
  }

  listModules() {
    return [...this.modules.values()];
  }

  summary() {
    const services = this.listServices();
    return {
      service_count: services.length,
      module_count: this.modules.size,
      healthy_count: services.filter((service) => service.state === "running").length,
      degraded_count: services.filter((service) => service.state === "degraded").length,
      error_count: services.filter((service) => service.state === "error").length
    };
  }
}
