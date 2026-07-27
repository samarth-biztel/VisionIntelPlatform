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
import { ServiceRegistry } from "./registry.js";
import { seedRuntime } from "./seed-runtime.js";

const shouldCheckOnly = process.argv.includes("--check");
const port = Number(process.env.PORT ?? 7080);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const config = await loadPlatformConfig();
const registry = new ServiceRegistry();
const bus = new InMemoryBus();
seedRuntime(registry, bus, config);

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
      "module-manifest.v1"
    ],
    topics: canonicalTopics
  });
});

app.get("/api/dashboard-summary", (_request, response) => {
  response.json({
    registry: registry.summary(),
    config: {
      device_id: config.device.device_id,
      site_id: config.site.site_id,
      enabled_modules: config.site.enabled_modules
    },
    bus: bus.snapshot(),
    samarth_queue: [
      "Bus topic naming convention",
      "Service interface",
      "Core registry and health loop",
      "Config loader",
      "Operator dashboard shell"
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

app.get("/api/modules", (_request, response) => {
  response.json({ modules: registry.listModules() });
});

app.post("/api/modules/register", (request, response, next) => {
  try {
    const module = registry.registerModule(request.body);
    response.status(201).json({ module });
  } catch (error) {
    next(error);
  }
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

  response.status(500).json({
    error: "internal_error",
    message: error.message
  });
});

if (shouldCheckOnly) {
  console.log("api: ok");
} else {
  app.listen(port, () => {
    console.log(`BiztelAI core API listening on http://localhost:${port}`);
  });
}
