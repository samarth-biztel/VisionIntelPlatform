import { assertTopic, topicFamily } from "@biztel/contracts";

export class InMemoryBus {
  constructor() {
    this.messages = [];
    this.subscribers = new Map();
  }

  subscribe(serviceId, topicPattern) {
    assertTopic(topicPattern.replace("*", "all"));
    const current = this.subscribers.get(serviceId) ?? new Set();
    current.add(topicPattern);
    this.subscribers.set(serviceId, current);
  }

  publish(message) {
    const topic = assertTopic(message.topic);
    const entry = {
      id: `${Date.now()}-${this.messages.length + 1}`,
      topic,
      family: topicFamily(topic),
      timestamp_utc: new Date().toISOString(),
      message
    };
    this.messages.unshift(entry);
    this.messages = this.messages.slice(0, 100);
    return entry;
  }

  snapshot() {
    return {
      mode: "in-memory",
      retained_messages: this.messages.length,
      subscribers: [...this.subscribers.entries()].map(([service_id, topics]) => ({
        service_id,
        topics: [...topics]
      })),
      recent_messages: this.messages.slice(0, 10)
    };
  }
}
