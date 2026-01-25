/**
 * WebSocket Server for T-Hub
 * Provides real-time updates for components, search, and notifications
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class WebSocketServer extends EventEmitter {
  constructor(server, options = {}) {
    super();

    this.wss = new WebSocket.Server({
      server,
      path: options.path || '/ws',
      clientTracking: true
    });

    this.clients = new Map(); // connection ID -> client info
    this.subscriptions = new Map(); // subscription type -> Set of connection IDs
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0
    };

    this.setupServer();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      const connectionId = this.generateId();

      const clientInfo = {
        id: connectionId,
        ws,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: new Date(),
        subscriptions: new Set(),
        user: null
      };

      this.clients.set(connectionId, clientInfo);
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      console.log(`[WebSocket] Client connected: ${connectionId} (${this.stats.activeConnections} active)`);

      // Send welcome message
      this.sendToClient(connectionId, {
        type: 'connection',
        data: {
          connectionId,
          message: 'Connected to T-Hub WebSocket',
          timestamp: new Date().toISOString()
        }
      });

      // Handle messages from client
      ws.on('message', (message) => {
        this.handleMessage(connectionId, message);
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for client ${connectionId}:`, error);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(connectionId, rawMessage) {
    this.stats.messagesReceived++;

    try {
      const message = JSON.parse(rawMessage);
      const client = this.clients.get(connectionId);

      if (!client) {
        return;
      }

      console.log(`[WebSocket] Message from ${connectionId}:`, message.type);

      switch (message.type) {
        case 'authenticate':
          this.handleAuthenticate(connectionId, message.data);
          break;

        case 'subscribe':
          this.handleSubscribe(connectionId, message.data);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, message.data);
          break;

        case 'ping':
          this.sendToClient(connectionId, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          this.sendToClient(connectionId, {
            type: 'error',
            data: { message: `Unknown message type: ${message.type}` }
          });
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to parse message from ${connectionId}:`, error);
      this.sendToClient(connectionId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle client authentication
   */
  handleAuthenticate(connectionId, data) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    // In production, validate the token with JWT
    // For now, we'll just store user info
    client.user = {
      id: data.userId,
      username: data.username
    };

    this.sendToClient(connectionId, {
      type: 'authenticated',
      data: {
        success: true,
        user: client.user
      }
    });

    console.log(`[WebSocket] Client ${connectionId} authenticated as ${data.username}`);
  }

  /**
   * Handle subscription request
   */
  handleSubscribe(connectionId, data) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    const { channel } = data;

    if (!channel) {
      this.sendToClient(connectionId, {
        type: 'error',
        data: { message: 'Channel is required for subscription' }
      });
      return;
    }

    // Add subscription
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    this.subscriptions.get(channel).add(connectionId);
    client.subscriptions.add(channel);

    this.sendToClient(connectionId, {
      type: 'subscribed',
      data: { channel }
    });

    console.log(`[WebSocket] Client ${connectionId} subscribed to ${channel}`);
  }

  /**
   * Handle unsubscribe request
   */
  handleUnsubscribe(connectionId, data) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    const { channel } = data;

    if (this.subscriptions.has(channel)) {
      this.subscriptions.get(channel).delete(connectionId);
    }

    client.subscriptions.delete(channel);

    this.sendToClient(connectionId, {
      type: 'unsubscribed',
      data: { channel }
    });

    console.log(`[WebSocket] Client ${connectionId} unsubscribed from ${channel}`);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(connectionId) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    // Remove from all subscriptions
    for (const channel of client.subscriptions) {
      if (this.subscriptions.has(channel)) {
        this.subscriptions.get(channel).delete(connectionId);
      }
    }

    this.clients.delete(connectionId);
    this.stats.activeConnections--;

    console.log(`[WebSocket] Client disconnected: ${connectionId} (${this.stats.activeConnections} active)`);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(connectionId, message) {
    const client = this.clients.get(connectionId);

    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      console.error(`[WebSocket] Failed to send to ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients subscribed to a channel
   */
  broadcast(channel, message) {
    const subscribers = this.subscriptions.get(channel);

    if (!subscribers || subscribers.size === 0) {
      return 0;
    }

    let sent = 0;

    for (const connectionId of subscribers) {
      if (this.sendToClient(connectionId, message)) {
        sent++;
      }
    }

    console.log(`[WebSocket] Broadcasted to ${channel}: ${sent} clients`);

    return sent;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(message) {
    let sent = 0;

    for (const [connectionId, client] of this.clients) {
      if (this.sendToClient(connectionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Notify about new component
   */
  notifyComponentCreated(component) {
    this.broadcast('components', {
      type: 'component.created',
      data: component,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about component update
   */
  notifyComponentUpdated(component) {
    this.broadcast('components', {
      type: 'component.updated',
      data: component,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about component deletion
   */
  notifyComponentDeleted(componentId, componentName) {
    this.broadcast('components', {
      type: 'component.deleted',
      data: { id: componentId, name: componentName },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about component download
   */
  notifyComponentDownloaded(component) {
    this.broadcast('downloads', {
      type: 'component.downloaded',
      data: {
        id: component.id,
        name: component.name,
        version: component.version,
        downloads: component.downloads
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about user registration
   */
  notifyUserRegistered(user) {
    this.broadcast('users', {
      type: 'user.registered',
      data: {
        id: user.id,
        username: user.username
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send system notification
   */
  sendSystemNotification(message, level = 'info') {
    this.broadcastAll({
      type: 'system.notification',
      data: {
        message,
        level
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get WebSocket statistics
   */
  getStats() {
    return {
      ...this.stats,
      channels: Array.from(this.subscriptions.keys()).map(channel => ({
        name: channel,
        subscribers: this.subscriptions.get(channel).size
      })),
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        user: client.user?.username,
        subscriptions: Array.from(client.subscriptions),
        connectedAt: client.connectedAt
      }))
    };
  }

  /**
   * Close all connections and shutdown
   */
  async shutdown() {
    console.log('[WebSocket] Shutting down...');

    // Notify all clients
    this.broadcastAll({
      type: 'system.shutdown',
      data: { message: 'Server is shutting down' },
      timestamp: new Date().toISOString()
    });

    // Close all connections
    for (const [connectionId, client] of this.clients) {
      client.ws.close(1001, 'Server shutdown');
    }

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('[WebSocket] Shutdown complete');
        resolve();
      });
    });
  }

  /**
   * Generate unique connection ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = WebSocketServer;
