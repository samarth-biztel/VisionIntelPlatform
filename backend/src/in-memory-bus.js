import { assertTopic, assertTopicPattern, topicFamily, topicMatches } from "@biztel/contracts";

const RETAINED_MESSAGE_LIMIT = 100;

/**
 * Dumb transport. Fans messages out by topic and knows nothing else.
 *
 * A subscriber that throws is contained: its failure is recorded against that
 * subscription and never reaches the publisher or the other subscribers.
 */
export class InMemoryBus {
  constructor({ retainedMessageLimit = RETAINED_MESSAGE_LIMIT } = {}) {
    this.retainedMessageLimit = retainedMessageLimit;
    this.messages = [];
    this.subscriptions = [];
  }

  subscribe(serviceId, topicPattern, handler) {
    const pattern = assertTopicPattern(topicPattern);
    const subscription = {
      id: `${serviceId}:${pattern}:${this.subscriptions.length + 1}`,
      service_id: serviceId,
      pattern,
      handler,
      delivered: 0,
      failed: 0,
      last_error: null,
      subscribed_at_utc: new Date().toISOString()
    };
    this.subscriptions.push(subscription);

    return function unsubscribe() {
      const index = this.subscriptions.indexOf(subscription);
      if (index !== -1) {
        this.subscriptions.splice(index, 1);
      }
    }.bind(this);
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
    this.messages = this.messages.slice(0, this.retainedMessageLimit);

    // Copy first: a handler may publish, subscribe, or unsubscribe re-entrantly.
    const matched = [...this.subscriptions].filter((subscription) =>
      topicMatches(subscription.pattern, topic)
    );

    for (const subscription of matched) {
      if (typeof subscription.handler !== "function") {
        continue;
      }
      try {
        subscription.handler(message.payload, entry);
        subscription.delivered += 1;
      } catch (error) {
        subscription.failed += 1;
        subscription.last_error = error.message;
        console.error(
          `bus: ${subscription.service_id} failed on ${topic}: ${error.message}`
        );
      }
    }

    return { ...entry, delivered_to: matched.length };
  }

  listMessages({ topic, limit = 25 } = {}) {
    const messages = topic ? this.messages.filter((entry) => entry.topic === assertTopic(topic)) : this.messages;
    return messages.slice(0, limit);
  }

  listSubscriptions() {
    return this.subscriptions.map(({ handler: _handler, ...subscription }) => subscription);
  }

  snapshot() {
    const byService = new Map();
    for (const subscription of this.subscriptions) {
      const current = byService.get(subscription.service_id) ?? {
        service_id: subscription.service_id,
        topics: [],
        delivered: 0,
        failed: 0
      };
      current.topics.push(subscription.pattern);
      current.delivered += subscription.delivered;
      current.failed += subscription.failed;
      byService.set(subscription.service_id, current);
    }

    return {
      mode: "in-memory",
      retained_messages: this.messages.length,
      subscriber_count: this.subscriptions.length,
      subscribers: [...byService.values()],
      recent_messages: this.messages.slice(0, 10)
    };
  }
}
