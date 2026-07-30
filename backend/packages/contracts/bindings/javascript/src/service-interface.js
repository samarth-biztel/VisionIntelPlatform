import { z } from "zod";
import { topicNameSchema, topicPatternSchema } from "./bus-topics.js";

export const serviceRoleSchema = z.enum([
  "core",
  "source",
  "module",
  "sink",
  "vision_runtime",
  "plc",
  "storage",
  "ui"
]);

export const runtimeStateSchema = z.enum([
  "starting",
  "running",
  "degraded",
  "error",
  "stopped"
]);

export const serviceRegistrationSchema = z.object({
  schema_version: z.literal("service-registration.v1"),
  service_id: z.string().min(1),
  display_name: z.string().min(1),
  role: serviceRoleSchema,
  version: z.string().min(1),
  host_id: z.string().min(1),
  process_id: z.number().int().positive().optional(),
  subscribes: z.array(topicPatternSchema).default([]),
  publishes: z.array(topicNameSchema).default([]),
  health_topic: topicNameSchema.default("health.heartbeat"),
  started_at_utc: z.string().datetime(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
});

export const heartbeatSchema = z.object({
  schema_version: z.literal("service-heartbeat.v1"),
  service_id: z.string().min(1),
  state: runtimeStateSchema,
  timestamp_utc: z.string().datetime(),
  uptime_ms: z.number().int().nonnegative(),
  message: z.string().optional(),
  metrics: z.record(z.number()).default({})
});

export const shutdownCommandSchema = z.object({
  schema_version: z.literal("service-shutdown.v1"),
  service_id: z.string().min(1),
  reason: z.string().min(1),
  requested_by: z.string().min(1),
  timestamp_utc: z.string().datetime()
});
