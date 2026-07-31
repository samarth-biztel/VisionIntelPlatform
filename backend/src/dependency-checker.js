import { getConfigValue } from "./config-loader.js";

function serviceIsRunning(service) {
  return service?.state === "running" && service.alive;
}

function topicIsPublished(services, topic) {
  return services.some((service) => service.publishes.some((published) => published === topic));
}

function checkServiceRoles(services, roles) {
  return roles.map((role) => {
    const matching = services.filter((service) => service.role === role);
    const running = matching.filter(serviceIsRunning);
    return {
      kind: "service_role",
      name: role,
      ok: running.length > 0,
      available: matching.map((service) => ({
        service_id: service.service_id,
        state: service.state,
        alive: service.alive,
        heartbeat_status: service.heartbeat_status
      }))
    };
  });
}

function checkTopics(services, topics) {
  return topics.map((topic) => ({
    kind: "topic",
    name: topic,
    ok: topicIsPublished(services, topic),
    publishers: services
      .filter((service) => service.publishes.some((published) => published === topic))
      .map((service) => service.service_id)
  }));
}

function checkConfigKeys(config, keys) {
  return keys.map((key) => {
    const value = getConfigValue(config, key);
    return {
      kind: "config_key",
      name: key,
      ok: value !== undefined,
      present: value !== undefined
    };
  });
}

function checkRunnableServices(services, serviceIds) {
  return serviceIds.map((serviceId) => {
    const service = services.find((candidate) => candidate.service_id === serviceId);
    return {
      kind: "device_run_service",
      name: serviceId,
      ok: serviceIsRunning(service),
      state: service?.state ?? "missing",
      alive: service?.alive ?? false,
      heartbeat_status: service?.heartbeat_status ?? "missing"
    };
  });
}

function checkEnabledModules(modules, enabledModuleIds) {
  return enabledModuleIds.map((moduleId) => {
    const manifest = modules.find((module) => module.module_id === moduleId);
    return {
      kind: "enabled_module_manifest",
      name: moduleId,
      ok: Boolean(manifest),
      display_name: manifest?.display_name ?? null
    };
  });
}

export function checkPlatformDependencies({ registry, config }) {
  const services = registry.listServices();
  const modules = registry.listModules();
  const checks = [
    ...checkRunnableServices(services, config.device.runs),
    ...checkEnabledModules(modules, config.site.enabled_modules)
  ];

  const modulesReport = modules.map((manifest) => {
    const moduleChecks = [
      ...checkServiceRoles(services, manifest.needs.services),
      ...checkTopics(services, manifest.needs.input_topics),
      ...checkConfigKeys(config, manifest.needs.config_keys)
    ];

    return {
      module_id: manifest.module_id,
      display_name: manifest.display_name,
      ready: moduleChecks.every((check) => check.ok),
      checks: moduleChecks
    };
  });

  for (const moduleReport of modulesReport) {
    checks.push(
      ...moduleReport.checks.map((check) => ({
        ...check,
        module_id: moduleReport.module_id
      }))
    );
  }

  const failed = checks.filter((check) => !check.ok);

  return {
    ok: failed.length === 0,
    checked_at_utc: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length
    },
    failed,
    modules: modulesReport,
    checks
  };
}
