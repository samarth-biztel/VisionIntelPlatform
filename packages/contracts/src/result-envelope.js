import { z } from "zod";
import { topicNameSchema } from "./bus-topics.js";

export const resultEnvelopeSchema = z.object({
  schema_version: z.literal("result-envelope.v1"),
  result_id: z.string().min(1),
  frame_id: z.string().min(1),
  source_topic: topicNameSchema.refine((topic) => topic.startsWith("camera."), {
    message: "Result source_topic must start with camera."
  }),
  result_topic: topicNameSchema.refine((topic) => topic.startsWith("result."), {
    message: "Result topic must start with result."
  }),
  module_id: z.string().min(1),
  verdict: z.enum(["pass", "fail", "warn", "unknown", "error"]),
  confidence: z.number().min(0).max(1).optional(),
  latency_ms: z.number().nonnegative(),
  model: z
    .object({
      model_id: z.string().min(1),
      version: z.string().min(1),
      runtime_backend: z.enum(["trt", "onnx", "torch", "classical_cv", "none"])
    })
    .optional(),
  payload: z.record(z.unknown()).default({}),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .optional(),
  timestamp_utc: z.string().datetime()
});
