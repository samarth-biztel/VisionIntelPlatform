import { z } from "zod";
import { topicNameSchema, topicPatternSchema } from "./bus-topics.js";

export const moduleManifestSchema = z.object({
  schema_version: z.literal("module-manifest.v1"),
  module_id: z.string().min(1),
  display_name: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().min(1),
  kind: z.enum(["vision_gpu", "vision_classical", "metrology", "logic"]),
  requires: z.object({
    input_topics: z.array(topicPatternSchema),
    models: z.array(z.string()).default([]),
    config_keys: z.array(z.string()).default([]),
    services: z.array(z.enum(["vision_runtime", "plc", "storage"])).default([])
  }),
  provides: z.object({
    result_topics: z.array(topicNameSchema),
    ui_panel: z
      .object({
        route: z.string().min(1),
        mount_slot: z.string().min(1)
      })
      .optional()
  }),
  lifecycle: z.object({
    init: z.literal("init(config)"),
    frame_handler: z.literal("on_frame(frame_envelope)"),
    publish: z.literal("publish(result_envelope)"),
    teardown: z.literal("teardown()")
  })
});

export const moduleLifecycleNames = Object.freeze([
  "init(config)",
  "on_frame(frame_envelope)",
  "publish(result_envelope)",
  "teardown()"
]);
