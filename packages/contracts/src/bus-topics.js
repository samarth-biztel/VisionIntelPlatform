import { z } from "zod";

export const TOPIC_FAMILIES = Object.freeze({
  CAMERA: "camera",
  RESULT: "result",
  CONTROL: "control",
  EVENT: "event",
  HEALTH: "health"
});

export const topicNameSchema = z
  .string()
  .min(3)
  .regex(
    /^(camera|result|control|event|health)\.[a-z0-9][a-z0-9_.-]*$/,
    "Topic must be family.name, for example camera.line1 or result.ai-supervisor"
  );

export function assertTopic(topic) {
  return topicNameSchema.parse(topic);
}

export function topicFamily(topic) {
  const validTopic = assertTopic(topic);
  return validTopic.split(".")[0];
}

export function isCameraTopic(topic) {
  return topicFamily(topic) === TOPIC_FAMILIES.CAMERA;
}

export function isResultTopic(topic) {
  return topicFamily(topic) === TOPIC_FAMILIES.RESULT;
}

export const canonicalTopics = Object.freeze({
  cameraLine1: "camera.line1",
  resultAiSupervisor: "result.ai-supervisor",
  resultImageInspection: "result.image-inspection",
  resultOcr: "result.ocr",
  eventServiceRegistered: "event.service.registered",
  eventServiceUnhealthy: "event.service.unhealthy",
  controlShutdown: "control.shutdown",
  healthHeartbeat: "health.heartbeat"
});
