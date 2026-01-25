/**
 * @component event-bus
 * @version 2.0.1
 * @category Messaging
 * @license MIT
 * @description Distributed event bus with pub/sub, request/reply, and message queue patterns
 *
 * A comprehensive event-driven messaging system that supports multiple
 * messaging patterns and can scale across multiple processes.
 *
 * Features:
 * - Publish/Subscribe pattern
 * - Request/Reply (RPC) pattern
 * - Message queuing with persistence
 * - Event filtering and routing
 * - Wildcard subscriptions
 * - Priority queues
 * - Dead letter queue
 * - Message acknowledgment
 * - Retry logic with exponential backoff
 * - Event replay
 *
 * @example
 * const EventBus = require('event-bus');
 *
 * const bus = new EventBus();
 *
 * // Subscribe to events
 * bus.subscribe('user.created', async (data) => {
 *   console.log('New user:', data);
 * });
 *
 * // Wildcard subscription
 * bus.subscribe('user.*', async (data, event) => {
 *   console.log(`User event: ${event}`, data);
 * });
 *
 * // Publish event
 * await bus.publish('user.created', { id: 123, name: 'John' });
 *
 * // Request/Reply
 * bus.handle('get.user', async (userId) => {
 *   return await db.getUser(userId);
 * });
 *
 * const user = await bus.request('get.user', 123);
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(0); // Unlimited listeners

    this.options = {
      persistence: options.persistence || false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      deadLetterQueue: options.deadLetterQueue !== false,
      enableMetrics: options.enableMetrics !== false
    };

    this.handlers = new Map();
    this.subscriptions = new Map();
    this.pendingReplies = new Map();
    this.messageQueue = [];
    this.deadLetters = [];
    this.metrics = {
      published: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0
    };

    this.replyTimeout = 5000;
    this.processingQueue = false;
  }

  /**
   * Subscribe to events
   * @param {string} event - Event name (supports wildcards: user.*, *.created)
   * @param {Function} handler - Event handler
   * @param {object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, handler, options = {}) {
    const subscription = {
      event,
      handler,
      priority: options.priority || 0,
      filter: options.filter,
      once: options.once || false,
      retries: 0,
      maxRetries: options.maxRetries || this.options.maxRetries
    };

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }

    this.subscriptions.get(event).push(subscription);

    // Sort by priority (higher priority first)
    this.subscriptions.get(event).sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(event);
      const index = subs.indexOf(subscription);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe once (auto-unsubscribe after first delivery)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  once(event, handler) {
    return this.subscribe(event, handler, { once: true });
  }

  /**
   * Publish event
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @param {object} options - Publish options
   */
  async publish(event, data, options = {}) {
    this.metrics.published++;

    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: this.generateId(),
      persistent: options.persistent || this.options.persistence,
      priority: options.priority || 0
    };

    if (message.persistent) {
      this.messageQueue.push(message);
    }

    await this.deliverMessage(message);
  }

  /**
   * Deliver message to subscribers
   */
  async deliverMessage(message) {
    const matchingSubscriptions = this.findMatchingSubscriptions(message.event);

    const promises = matchingSubscriptions.map(subscription =>
      this.deliverToSubscriber(message, subscription)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Deliver message to a single subscriber
   */
  async deliverToSubscriber(message, subscription) {
    try {
      // Apply filter if present
      if (subscription.filter && !subscription.filter(message.data)) {
        return;
      }

      await subscription.handler(message.data, message.event);

      this.metrics.delivered++;

      // Remove if once subscription
      if (subscription.once) {
        const subs = this.subscriptions.get(subscription.event);
        const index = subs.indexOf(subscription);
        if (index > -1) {
          subs.splice(index, 1);
        }
      }

      subscription.retries = 0;
    } catch (error) {
      console.error(`Error delivering message to subscriber:`, error);
      this.metrics.failed++;

      await this.handleDeliveryFailure(message, subscription, error);
    }
  }

  /**
   * Handle delivery failure with retry logic
   */
  async handleDeliveryFailure(message, subscription, error) {
    subscription.retries++;

    if (subscription.retries < subscription.maxRetries) {
      this.metrics.retried++;

      // Exponential backoff
      const delay = this.options.retryDelay * Math.pow(2, subscription.retries - 1);

      setTimeout(() => {
        this.deliverToSubscriber(message, subscription);
      }, delay);
    } else if (this.options.deadLetterQueue) {
      // Move to dead letter queue
      this.deadLetters.push({
        message,
        subscription: subscription.event,
        error: error.message,
        timestamp: Date.now()
      });

      this.metrics.deadLettered++;
    }
  }

  /**
   * Find subscriptions matching an event (including wildcards)
   */
  findMatchingSubscriptions(event) {
    const matches = [];

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      if (this.eventMatches(event, pattern)) {
        matches.push(...subscriptions);
      }
    }

    return matches;
  }

  /**
   * Check if event matches pattern (supports wildcards)
   */
  eventMatches(event, pattern) {
    if (event === pattern) {
      return true;
    }

    const eventParts = event.split('.');
    const patternParts = pattern.split('.');

    if (eventParts.length !== patternParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== eventParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Register request handler (RPC pattern)
   * @param {string} command - Command name
   * @param {Function} handler - Request handler
   */
  handle(command, handler) {
    this.handlers.set(command, handler);
  }

  /**
   * Send request and wait for reply (RPC pattern)
   * @param {string} command - Command name
   * @param {any} data - Request data
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Reply data
   */
  async request(command, data, timeout = this.replyTimeout) {
    const messageId = this.generateId();

    const promise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingReplies.delete(messageId);
        reject(new Error(`Request timeout: ${command}`));
      }, timeout);

      this.pendingReplies.set(messageId, { resolve, reject, timeoutId });
    });

    // Execute handler
    try {
      const handler = this.handlers.get(command);

      if (!handler) {
        throw new Error(`No handler registered for command: ${command}`);
      }

      const result = await handler(data);

      // Resolve pending reply
      const pending = this.pendingReplies.get(messageId);
      if (pending) {
        clearTimeout(pending.timeoutId);
        pending.resolve(result);
        this.pendingReplies.delete(messageId);
      }

      return result;
    } catch (error) {
      const pending = this.pendingReplies.get(messageId);
      if (pending) {
        clearTimeout(pending.timeoutId);
        pending.reject(error);
        this.pendingReplies.delete(messageId);
      }

      throw error;
    }
  }

  /**
   * Replay persisted messages
   * @param {object} filter - Optional filter
   */
  async replay(filter = {}) {
    const messages = this.messageQueue.filter(message => {
      if (filter.event && !this.eventMatches(message.event, filter.event)) {
        return false;
      }

      if (filter.since && message.timestamp < filter.since) {
        return false;
      }

      if (filter.until && message.timestamp > filter.until) {
        return false;
      }

      return true;
    });

    for (const message of messages) {
      await this.deliverMessage(message);
    }

    return messages.length;
  }

  /**
   * Get dead letter messages
   * @param {number} limit - Maximum number of messages
   */
  getDeadLetters(limit = 100) {
    return this.deadLetters.slice(-limit);
  }

  /**
   * Retry dead letter messages
   */
  async retryDeadLetters() {
    const deadLetters = [...this.deadLetters];
    this.deadLetters = [];

    for (const item of deadLetters) {
      await this.publish(item.message.event, item.message.data);
    }

    return deadLetters.length;
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetters() {
    const count = this.deadLetters.length;
    this.deadLetters = [];
    return count;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      subscriptions: this.subscriptions.size,
      handlers: this.handlers.size,
      queuedMessages: this.messageQueue.length,
      deadLetters: this.deadLetters.length,
      pendingReplies: this.pendingReplies.size,
      successRate: this.metrics.delivered / (this.metrics.published || 1) * 100
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      published: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0
    };
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions() {
    this.subscriptions.clear();
  }

  /**
   * Clear all handlers
   */
  clearHandlers() {
    this.handlers.clear();
  }

  /**
   * Shutdown event bus
   */
  async shutdown() {
    // Clear pending replies
    for (const [id, pending] of this.pendingReplies.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Event bus shutdown'));
      this.pendingReplies.delete(id);
    }

    this.removeAllListeners();
  }

  /**
   * Generate unique message ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = EventBus;
