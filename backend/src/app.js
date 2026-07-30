import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  canonicalTopics,
  frameEnvelopeSchema,
  resultEnvelopeSchema
} from "@biztel/contracts";
import { loadPlatformConfig } from "./config-loader.js";
import { InMemoryBus } from "./in-memory-bus.js";
import { LifecycleOrchestrator } from "./lifecycle-orchestrator.js";
import { ServiceRegistry } from "./registry.js";
import { seedRuntime } from "./seed-runtime.js";

export async function createApp({ checkOnly = false } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const config = await loadPlatformConfig();
  const registry = new ServiceRegistry();
  const bus = new InMemoryBus();
  const runtime = seedRuntime(registry, bus, config, { verbose: !checkOnly });
  const lifecycle = new LifecycleOrchestrator({
    registry,
    bus,
    runtimeServices: {
      [runtime.source.source_id]: runtime.source,
      [runtime.echo.manifest.module_id]: runtime.echo,
      [runtime.logSink.sink_id]: runtime.logSink
    }
  });

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "core",
      timestamp_utc: new Date().toISOString()
    });
  });

  app.get("/api/config", (_request, response) => {
    response.json(config);
  });

  app.get("/api/contracts", (_request, response) => {
    response.json({
      tier0: [
        "frame-envelope.v1",
        "result-envelope.v1",
        "service-registration.v1",
        "service-heartbeat.v1",
        "module-manifest.v1",
        "service-shutdown.v1"
      ],
      topics: canonicalTopics
    });
  });

  app.get("/api/dashboard-summary", (_request, response) => {
    response.json({
      registry: registry.summary(),
      services: registry.listServices(),
      modules: registry.listModules(),
      config: {
        device_id: config.device.device_id,
        site_id: config.site.site_id,
        enabled_modules: config.site.enabled_modules
      },
      bus: bus.snapshot(),
      lifecycle: {
        startup: lifecycle.startupPlan(),
        shutdown: lifecycle.shutdownPlan()
      },
      samarth_queue: [
        "Manifest needs/provides spec",
        "Publish/subscribe bus",
        "Service registration",
        "Heartbeat alive-check",
        "Startup/shutdown sequencing"
      ]
    });
  });

  app.get("/api/services", (_request, response) => {
    response.json({ services: registry.listServices() });
  });

  app.post("/api/services/register", (request, response, next) => {
    try {
      const service = registry.registerService(request.body);
      bus.publish({
        topic: canonicalTopics.eventServiceRegistered,
        payload: {
          service_id: service.service_id
        }
      });
      response.status(201).json({ service });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/services/:serviceId/heartbeat", (request, response, next) => {
    try {
      const service = registry.heartbeat({
        ...request.body,
        service_id: request.params.serviceId
      });
      response.json({ service });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/services/:serviceId/shutdown", (request, response, next) => {
    try {
      const service = lifecycle.requestShutdown({
        service_id: request.params.serviceId,
        reason: request.body?.reason ?? "operator request",
        requested_by: request.body?.requested_by ?? "operator"
      });
      response.json({ service, shutdown_plan: lifecycle.shutdownPlan() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/modules", (_request, response) => {
    response.json({ modules: registry.listModules() });
  });

  app.post("/api/modules/register", (request, response, next) => {
    try {
      const module = registry.registerModule(request.body);
      response.status(201).json({ module, readiness: lifecycle.moduleReadiness(module.module_id) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/modules/:moduleId/readiness", (request, response, next) => {
    try {
      response.json({ readiness: lifecycle.moduleReadiness(request.params.moduleId) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/lifecycle/startup-plan", (_request, response) => {
    response.json(lifecycle.startupPlan());
  });

  app.get("/api/lifecycle/shutdown-plan", (_request, response) => {
    response.json({ services: lifecycle.shutdownPlan() });
  });

  app.post("/api/validate/frame", (request, response, next) => {
    try {
      response.json({ frame: frameEnvelopeSchema.parse(request.body) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/validate/result", (request, response, next) => {
    try {
      response.json({ result: resultEnvelopeSchema.parse(request.body) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/source/capture", (_request, response, next) => {
    try {
      const frame = runtime.source.captureOnce();
      response.status(202).json({
        frame_id: frame.frame_id,
        topic: frame.source_topic,
        results: runtime.logSink.recent(1)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sink/log", (_request, response) => {
    response.json({
      sink_id: "log-sink",
      count: runtime.logSink.count,
      entries: runtime.logSink.recent(10)
    });
  });

  app.get("/api/bus", (_request, response) => {
    response.json(bus.snapshot());
  });

  app.get("/api/bus/messages", (request, response, next) => {
    try {
      response.json({
        messages: bus.listMessages({
          topic: request.query.topic,
          limit: Number(request.query.limit ?? 25)
        })
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/bus/subscriptions", (_request, response) => {
    response.json({ subscriptions: bus.listSubscriptions() });
  });

  app.post("/api/bus/publish", (request, response, next) => {
    try {
      const payload = z
        .object({
          topic: z.string(),
          payload: z.unknown().default({})
        })
        .parse(request.body);
      response.status(202).json({ message: bus.publish(payload) });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "contract_validation_failed",
        issues: error.issues
      });
      return;
    }

    if (typeof error.status === "number") {
      response.status(error.status).json({
        error: error.code,
        message: error.message
      });
      return;
    }

    response.status(500).json({
      error: "internal_error",
      message: error.message
    });
  });

  return { app, config, registry, bus, runtime, lifecycle };
}


