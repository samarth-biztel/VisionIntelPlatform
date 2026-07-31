import { z } from "zod";
import { topicNameSchema, topicPatternSchema } from "./bus-topics.js";

const moduleNeedsSchema = z.object({
  input_topics: z.array(topicPatternSchema),
  models: z.array(z.string()).default([]),
  config_keys: z.array(z.string()).default([]),
  services: z.array(z.enum(["vision_runtime", "plc", "storage"])).default([])
});

const moduleProvidesSchema = z.object({
  result_topics: z.array(topicNameSchema),
  ui_panel: z
    .object({
      route: z.string().min(1),
      mount_slot: z.string().min(1)
    })
    .optional()
});

const moduleLifecycleSchema = z.object({
  init: z.literal("init(config)"),
  frame_handler: z.literal("on_frame(frame_envelope)"),
  publish: z.literal("publish(result_envelope)"),
  teardown: z.literal("teardown()")
});

export const moduleManifestSchema = z
  .object({
    schema_version: z.literal("module-manifest.v1"),
    module_id: z.string().min(1),
    display_name: z.string().min(1),
    version: z.string().min(1),
    owner: z.string().min(1),
    kind: z.enum(["vision_gpu", "vision_classical", "metrology", "logic"]),
    needs: moduleNeedsSchema.optional(),
    requires: moduleNeedsSchema.optional(),
    provides: moduleProvidesSchema,
    lifecycle: moduleLifecycleSchema
  })
  .superRefine((manifest, context) => {
    if (!manifest.needs && !manifest.requires) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["needs"],
        message: "Manifest must declare per-module needs/provides; `requires` is accepted as a legacy alias."
      });
    }
  })
  .transform((manifest) => {
    const needs = manifest.needs ?? manifest.requires;
    return {
      ...manifest,
      needs,
      requires: manifest.requires ?? needs
    };
  });

export const moduleLifecycleNames = Object.freeze([
  "init(config)",
  "on_frame(frame_envelope)",
  "publish(result_envelope)",
  "teardown()"
]);
