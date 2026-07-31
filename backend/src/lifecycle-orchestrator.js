import { shutdownCommandSchema } from "@biztel/contracts";
import { ConflictError, NotFoundError } from "./errors.js";

const ROLE_START_ORDER = ["core", "vision_runtime", "source", "module", "sink", "ui"];
const ROLE_STOP_ORDER = [...ROLE_START_ORDER].reverse();

function roleRank(role, order) {
  const index = order.indexOf(role);
  return index === -1 ? order.length : index;
}

function serviceHasRole(services, role) {
  return services.some((service) => service.role === role && service.alive && service.state === "running");
}

function sortServices(services, order) {
  return [...services].sort((a, b) => {
    const roleDelta = roleRank(a.role, order) - roleRank(b.role, order);
    return roleDelta || a.service_id.localeCompare(b.service_id);
  });
}

export class LifecycleOrchestrator {
  constructor({ registry, bus, runtimeServices = {} }) {
    this.registry = registry;
    this.bus = bus;
    this.runtimeServices = runtimeServices;
  }

  startupPlan() {
    const services = this.registry.listServices();
    const modules = this.registry.listModules();

    return {
      order: sortServices(services, ROLE_START_ORDER).map((service) => ({
        service_id: service.service_id,
        role: service.role,
        state: service.state,
        alive: service.alive
      })),
      modules: modules.map((manifest) => this.moduleReadiness(manifest.module_id))
    };
  }

  moduleReadiness(moduleId) {
    const manifest = this.registry.getModule(moduleId);
    if (!manifest) {
      throw new NotFoundError(`Unknown module: ${moduleId}`);
    }

    const services = this.registry.listServices();
    const missingServices = manifest.needs.services.filter((role) => !serviceHasRole(services, role));
    const missingTopics = manifest.needs.input_topics.filter(
      (topic) => !services.some((service) => service.publishes.some((published) => published === topic))
    );

    return {
      module_id: manifest.module_id,
      display_name: manifest.display_name,
      ready: missingServices.length === 0 && missingTopics.length === 0,
      needs: manifest.needs,
      provides: manifest.provides,
      missing_services: missingServices,
      missing_input_topics: missingTopics
    };
  }

  shutdownPlan() {
    return sortServices(this.registry.listServices(), ROLE_STOP_ORDER).map((service) => ({
      service_id: service.service_id,
      role: service.role,
      state: service.state,
      alive: service.alive
    }));
  }

  requestStartup({ service_id, requested_by = "core" }) {
    const current = this.registry.getService(service_id);
    if (!current) {
      throw new NotFoundError(`Unknown service: ${service_id}`);
    }
    if (current.state === "running" && current.alive) {
      return {
        service: current,
        action: "skipped",
        message: "service already running"
      };
    }

    this.registry.markStarting(service_id, `startup requested by ${requested_by}`);
    const runtime = this.runtimeServices[service_id];
    runtime?.init?.();
    runtime?.start?.();
    const service = this.registry.markRunning(service_id);

    this.bus.publish({
      topic: "event.service.started",
      payload: {
        service_id,
        requested_by,
        timestamp_utc: new Date().toISOString()
      }
    });

    return {
      service,
      action: "started",
      message: runtime ? "runtime start hook completed" : "registry state marked running"
    };
  }

  startupAll({ requested_by = "core" } = {}) {
    const results = [];
    for (const service of sortServices(this.registry.listServices(), ROLE_START_ORDER)) {
      results.push(this.requestStartup({ service_id: service.service_id, requested_by }));
    }
    return {
      started_at_utc: new Date().toISOString(),
      results,
      startup_plan: this.startupPlan()
    };
  }

  requestShutdown({ service_id, reason, requested_by = "core" }) {
    const current = this.registry.getService(service_id);
    if (!current) {
      throw new NotFoundError(`Unknown service: ${service_id}`);
    }
    if (current.state === "stopped") {
      throw new ConflictError(`Service is already stopped: ${service_id}`);
    }

    const command = shutdownCommandSchema.parse({
      schema_version: "service-shutdown.v1",
      service_id,
      reason,
      requested_by,
      timestamp_utc: new Date().toISOString()
    });

    this.bus.publish({ topic: "control.shutdown", payload: command });
    this.runtimeServices[service_id]?.teardown?.();
    this.runtimeServices[service_id]?.stop?.();
    return this.registry.markStopped(service_id, reason);
  }

  shutdownAll({ reason = "ordered shutdown", requested_by = "core" } = {}) {
    const results = [];
    for (const service of sortServices(this.registry.listServices(), ROLE_STOP_ORDER)) {
      if (service.state === "stopped") {
        results.push({
          service,
          action: "skipped",
          message: "service already stopped"
        });
        continue;
      }
      results.push({
        service: this.requestShutdown({ service_id: service.service_id, reason, requested_by }),
        action: "stopped",
        message: "shutdown command published"
      });
    }
    return {
      stopped_at_utc: new Date().toISOString(),
      results,
      shutdown_plan: this.shutdownPlan()
    };
  }
}
