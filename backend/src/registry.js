import {
  heartbeatSchema,
  moduleManifestSchema,
  serviceRegistrationSchema
} from "@biztel/contracts";
import { NotFoundError } from "./errors.js";

const DEFAULT_HEARTBEAT_STALE_AFTER_MS = 30_000;

export class ServiceRegistry {
  constructor({ heartbeatStaleAfterMs = DEFAULT_HEARTBEAT_STALE_AFTER_MS } = {}) {
    this.services = new Map();
    this.modules = new Map();
    this.heartbeatStaleAfterMs = heartbeatStaleAfterMs;
  }

  registerService(payload) {
    const registration = serviceRegistrationSchema.parse(payload);
    const previous = this.services.get(registration.service_id);
    const record = {
      ...registration,
      last_heartbeat: previous?.last_heartbeat ?? null,
      state: previous?.state ?? "starting",
      stopped_reason: previous?.stopped_reason ?? null
    };
    this.services.set(registration.service_id, record);
    return this.decorateService(record);
  }

  heartbeat(payload) {
    const heartbeat = heartbeatSchema.parse(payload);
    const current = this.services.get(heartbeat.service_id);
    if (!current) {
      throw new NotFoundError(
        `Unknown service: ${heartbeat.service_id}. Register it before sending a heartbeat.`
      );
    }
    const record = {
      ...current,
      state: heartbeat.state,
      stopped_reason: heartbeat.state === "stopped" ? current.stopped_reason : null,
      last_heartbeat: heartbeat
    };
    this.services.set(heartbeat.service_id, record);
    return this.decorateService(record);
  }

  markStarting(serviceId, message = "startup requested") {
    const current = this.services.get(serviceId);
    if (!current) {
      throw new NotFoundError(`Unknown service: ${serviceId}`);
    }
    const record = {
      ...current,
      state: "starting",
      stopped_reason: null,
      last_heartbeat: {
        schema_version: "service-heartbeat.v1",
        service_id: serviceId,
        state: "starting",
        timestamp_utc: new Date().toISOString(),
        uptime_ms: current.last_heartbeat?.uptime_ms ?? 0,
        message,
        metrics: current.last_heartbeat?.metrics ?? {}
      }
    };
    this.services.set(serviceId, record);
    return this.decorateService(record);
  }

  markRunning(serviceId, metrics = {}) {
    const current = this.services.get(serviceId);
    if (!current) {
      throw new NotFoundError(`Unknown service: ${serviceId}`);
    }
    const startedAt = Date.parse(current.started_at_utc);
    const record = {
      ...current,
      state: "running",
      stopped_reason: null,
      last_heartbeat: {
        schema_version: "service-heartbeat.v1",
        service_id: serviceId,
        state: "running",
        timestamp_utc: new Date().toISOString(),
        uptime_ms: Number.isNaN(startedAt) ? 0 : Math.max(0, Date.now() - startedAt),
        metrics: { ...(current.last_heartbeat?.metrics ?? {}), ...metrics }
      }
    };
    this.services.set(serviceId, record);
    return this.decorateService(record);
  }

  markStopped(serviceId, reason) {
    const current = this.services.get(serviceId);
    if (!current) {
      throw new NotFoundError(`Unknown service: ${serviceId}`);
    }
    const record = {
      ...current,
      state: "stopped",
      stopped_reason: reason,
      last_heartbeat: {
        schema_version: "service-heartbeat.v1",
        service_id: serviceId,
        state: "stopped",
        timestamp_utc: new Date().toISOString(),
        uptime_ms: current.last_heartbeat?.uptime_ms ?? 0,
        message: reason,
        metrics: current.last_heartbeat?.metrics ?? {}
      }
    };
    this.services.set(serviceId, record);
    return this.decorateService(record);
  }

  registerModule(payload) {
    const manifest = moduleManifestSchema.parse(payload);
    this.modules.set(manifest.module_id, manifest);
    return manifest;
  }

  getService(serviceId) {
    const service = this.services.get(serviceId);
    return service ? this.decorateService(service) : null;
  }

  getModule(moduleId) {
    return this.modules.get(moduleId) ?? null;
  }

  listServices() {
    return [...this.services.values()].map((service) => this.decorateService(service));
  }

  listModules() {
    return [...this.modules.values()];
  }

  decorateService(service) {
    const heartbeatAt = service.last_heartbeat?.timestamp_utc;
    const heartbeatAgeMs = heartbeatAt ? Date.now() - Date.parse(heartbeatAt) : null;
    const heartbeat_status = !heartbeatAt
      ? "missing"
      : heartbeatAgeMs > this.heartbeatStaleAfterMs
        ? "stale"
        : "fresh";
    const alive = service.state !== "stopped" && service.state !== "error" && heartbeat_status === "fresh";

    return {
      ...service,
      alive,
      heartbeat_status,
      heartbeat_age_ms: heartbeatAgeMs,
      heartbeat_stale_after_ms: this.heartbeatStaleAfterMs
    };
  }

  summary() {
    const services = this.listServices();
    return {
      service_count: services.length,
      module_count: this.modules.size,
      healthy_count: services.filter((service) => service.state === "running" && service.alive).length,
      degraded_count: services.filter(
        (service) => service.state === "degraded" || service.heartbeat_status === "stale"
      ).length,
      error_count: services.filter((service) => service.state === "error").length,
      stopped_count: services.filter((service) => service.state === "stopped").length
    };
  }
}
