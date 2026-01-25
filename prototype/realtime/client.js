/**
 * WebSocket Client for T-Hub
 * Client-side library for connecting to T-Hub WebSocket server
 */

class THubWebSocketClient {
  constructor(url, options = {}) {
    this.url = url || 'ws://localhost:3000/ws';
    this.options = options;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.subscriptions = new Set();
    this.handlers = new Map();
    this.isConnected = false;
    this.isReconnecting = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Check if we're in Node.js or browser
        const WebSocket = this.getWebSocketConstructor();

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to T-Hub');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;

          // Resubscribe to channels after reconnect
          if (this.subscriptions.size > 0) {
            for (const channel of this.subscriptions) {
              this.subscribe(channel);
            }
          }

          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected');
          this.isConnected = false;
          this.emit('disconnected');

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Handle incoming message
   */
  handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);

      // Emit specific event for message type
      this.emit(message.type, message.data);

      // Emit general message event
      this.emit('message', message);
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Send message to server
   */
  send(type, data) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = JSON.stringify({ type, data });
    this.ws.send(message);
  }

  /**
   * Authenticate with token
   */
  authenticate(token, userId, username) {
    this.send('authenticate', {
      token,
      userId,
      username
    });
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel) {
    this.subscriptions.add(channel);

    if (this.isConnected) {
      this.send('subscribe', { channel });
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel) {
    this.subscriptions.delete(channel);

    if (this.isConnected) {
      this.send('unsubscribe', { channel });
    }
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event).add(handler);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (this.handlers.has(event)) {
      this.handlers.get(event).delete(handler);
    }
  }

  /**
   * Emit event to handlers
   */
  emit(event, data) {
    if (this.handlers.has(event)) {
      for (const handler of this.handlers.get(event)) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Handler error for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Send ping to keep connection alive
   */
  ping() {
    if (this.isConnected) {
      this.send('ping', {});
    }
  }

  /**
   * Close connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.subscriptions.clear();
    this.handlers.clear();
  }

  /**
   * Get WebSocket constructor (Node.js or browser)
   */
  getWebSocketConstructor() {
    // Browser
    if (typeof window !== 'undefined' && window.WebSocket) {
      return window.WebSocket;
    }

    // Node.js
    try {
      return require('ws');
    } catch (error) {
      throw new Error('WebSocket implementation not found. Install "ws" package for Node.js.');
    }
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = THubWebSocketClient;
} else if (typeof window !== 'undefined') {
  window.THubWebSocketClient = THubWebSocketClient;
}
