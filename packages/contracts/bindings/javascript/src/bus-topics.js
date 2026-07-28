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

const topicPrefixSchema = z
  .string()
  .regex(/^(camera|result|control|event|health)(\.[a-z0-9][a-z0-9_.-]*)?$/);

/**
 * A subscription pattern is either an exact topic (`camera.line1`) or a topic
 * prefix followed by a trailing wildcard segment (`result.*`, `event.service.*`).
 */
export const topicPatternSchema = z.string().refine(
  (pattern) => {
    if (pattern.endsWith(".*")) {
      return topicPrefixSchema.safeParse(pattern.slice(0, -2)).success;
    }
    return topicNameSchema.safeParse(pattern).success;
  },
  "Pattern must be an exact topic (camera.line1) or a prefix wildcard (result.*)"
);

export function assertTopicPattern(pattern) {
  return topicPatternSchema.parse(pattern);
}

export function topicMatches(pattern, topic) {
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}.`);
  }
  return pattern === topic;
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
