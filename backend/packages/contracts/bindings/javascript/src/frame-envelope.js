import { z } from "zod";
import { topicNameSchema } from "./bus-topics.js";

export const frameFormatSchema = z.object({
  pixel_format: z.enum(["BGR8", "RGB8", "GRAY8", "BAYER_RG8"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  channels: z.number().int().positive(),
  bit_depth: z.number().int().positive(),
  color_space: z.enum(["BGR", "RGB", "GRAY", "RAW"])
});

export const calibrationRefSchema = z.object({
  calibration_id: z.string().min(1),
  camera_model: z.string().min(1).optional(),
  profile_path: z.string().min(1).optional(),
  target_format: z.string().min(1)
});

export const payloadRefSchema = z.object({
  transport: z.enum(["shared_memory", "file", "inline_mock"]),
  ref: z.string().min(1),
  byte_length: z.number().int().nonnegative().optional(),
  checksum: z.string().min(1).optional()
});

export const frameEnvelopeSchema = z.object({
  schema_version: z.literal("frame-envelope.v1"),
  frame_id: z.string().min(1),
  timestamp_utc: z.string().datetime(),
  source_topic: topicNameSchema.refine((topic) => topic.startsWith("camera."), {
    message: "Frame source_topic must start with camera."
  }),
  source_id: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  format: frameFormatSchema,
  calibration: calibrationRefSchema,
  payload: payloadRefSchema,
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
});

export function createMockFrame(overrides = {}) {
  return frameEnvelopeSchema.parse({
    schema_version: "frame-envelope.v1",
    frame_id: "mock-frame-000001",
    timestamp_utc: new Date().toISOString(),
    source_topic: "camera.line1",
    source_id: "mock-source",
    sequence: 1,
    format: {
      pixel_format: "BGR8",
      width: 1920,
      height: 1080,
      channels: 3,
      bit_depth: 8,
      color_space: "BGR"
    },
    calibration: {
      calibration_id: "line1-default",
      target_format: "bgr_1080p"
    },
    payload: {
      transport: "inline_mock",
      ref: "synthetic://line1/frame/000001"
    },
    metadata: {},
    ...overrides
  });
}
