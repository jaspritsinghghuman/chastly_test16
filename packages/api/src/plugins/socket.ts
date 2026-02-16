// ============================================
// Socket Plugin
// WebSocket support for real-time features
// ============================================

import fp from 'fastify-plugin';
import { FastifyRequest } from 'fastify';
import { queueLogger } from '../utils/logger.js';

// Connected clients store
const connectedClients = new Map<string, any>();

// Broadcast to tenant
export function broadcastToTenant(
  tenantId: string,
  event: string,
  data: any
): void {
  for (const [clientId, client] of connectedClients.entries()) {
    if (client.tenantId === tenantId && client.socket.readyState === 1) {
      client.socket.send(JSON.stringify({ event, data }));
    }
  }
}

// Broadcast to user
export function broadcastToUser(
  userId: string,
  event: string,
  data: any
): void {
  for (const [clientId, client] of connectedClients.entries()) {
    if (client.userId === userId && client.socket.readyState === 1) {
      client.socket.send(JSON.stringify({ event, data }));
    }
  }
}

// Broadcast to conversation
export function broadcastToConversation(
  conversationId: string,
  event: string,
  data: any,
  excludeUserId?: string
): void {
  for (const [clientId, client] of connectedClients.entries()) {
    if (
      client.conversationId === conversationId &&
      client.socket.readyState === 1 &&
      client.userId !== excludeUserId
    ) {
      client.socket.send(JSON.stringify({ event, data }));
    }
  }
}

// Socket plugin
export const socketPlugin = fp(async (fastify) => {
  // WebSocket route for real-time updates
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    queueLogger.debug({ clientId }, 'WebSocket client connected');

    // Store client connection
    connectedClients.set(clientId, {
      socket,
      userId: null,
      tenantId: null,
      conversationId: null,
      connectedAt: new Date(),
    });

    // Handle incoming messages
    socket.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'auth':
            // Authenticate WebSocket connection
            try {
              const decoded = await fastify.jwt.verify(data.token);
              const client = connectedClients.get(clientId);
              if (client) {
                client.userId = decoded.id;
                client.tenantId = decoded.tenantId;
                socket.send(JSON.stringify({ type: 'auth', success: true }));
              }
            } catch (err) {
              socket.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid token' }));
            }
            break;

          case 'join_conversation':
            // Join a conversation room
            const client = connectedClients.get(clientId);
            if (client && client.userId) {
              client.conversationId = data.conversationId;
              socket.send(JSON.stringify({ type: 'joined', conversationId: data.conversationId }));
            }
            break;

          case 'leave_conversation':
            // Leave a conversation room
            const c = connectedClients.get(clientId);
            if (c) {
              c.conversationId = null;
              socket.send(JSON.stringify({ type: 'left', conversationId: data.conversationId }));
            }
            break;

          case 'typing':
            // Broadcast typing indicator
            const typingClient = connectedClients.get(clientId);
            if (typingClient && typingClient.conversationId) {
              broadcastToConversation(
                typingClient.conversationId,
                'typing',
                {
                  userId: typingClient.userId,
                  isTyping: data.isTyping,
                },
                typingClient.userId
              );
            }
            break;

          case 'ping':
            socket.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (err) {
        queueLogger.error({ err, clientId }, 'WebSocket message handling error');
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    // Handle disconnection
    socket.on('close', () => {
      queueLogger.debug({ clientId }, 'WebSocket client disconnected');
      connectedClients.delete(clientId);
    });

    // Send initial connection message
    socket.send(JSON.stringify({ type: 'connected', clientId }));
  });

  // Decorate fastify with socket helpers
  fastify.decorate('broadcastToTenant', broadcastToTenant);
  fastify.decorate('broadcastToUser', broadcastToUser);
  fastify.decorate('broadcastToConversation', broadcastToConversation);

  queueLogger.info('Socket plugin registered');
});

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    broadcastToTenant: typeof broadcastToTenant;
    broadcastToUser: typeof broadcastToUser;
    broadcastToConversation: typeof broadcastToConversation;
  }
}
