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
      order: [...services]
        .sort((a, b) => roleRank(a.role, ROLE_START_ORDER) - roleRank(b.role, ROLE_START_ORDER))
        .map((service) => ({
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
    return [...this.registry.listServices()]
      .sort((a, b) => roleRank(a.role, ROLE_STOP_ORDER) - roleRank(b.role, ROLE_STOP_ORDER))
      .map((service) => ({
        service_id: service.service_id,
        role: service.role,
        state: service.state,
        alive: service.alive
      }));
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
    return this.registry.markStopped(service_id, reason);
  }
}
