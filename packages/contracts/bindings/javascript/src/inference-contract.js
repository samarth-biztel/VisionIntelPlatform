import { z } from "zod";

export const inferenceRequestSchema = z.object({
  schema_version: z.literal("inference-request.v1"),
  request_id: z.string().min(1),
  module_id: z.string().min(1),
  model_id: z.string().min(1),
  frame_id: z.string().min(1),
  frame_payload_ref: z.string().min(1),
  backend_hint: z.enum(["trt", "onnx", "torch"]).optional(),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  timestamp_utc: z.string().datetime()
});

export const inferenceResponseSchema = z.object({
  schema_version: z.literal("inference-response.v1"),
  request_id: z.string().min(1),
  model_id: z.string().min(1),
  backend: z.enum(["trt", "onnx", "torch"]),
  latency_ms: z.number().nonnegative(),
  tensors: z.array(z.record(z.unknown())).default([]),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .optional(),
  timestamp_utc: z.string().datetime()
});
