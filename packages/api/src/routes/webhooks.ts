// ============================================
// Webhook Routes
// Webhook configuration and management
// ============================================

import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List webhooks
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const webhooks = await fastify.db.queryMany(
      `SELECT id, name, url, events, active, stats, created_at
       FROM webhooks
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: webhooks });
  });

  // Create webhook
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, url, events, retryConfig } = request.body as any;

    // Generate webhook secret
    const secret = randomBytes(32).toString('hex');

    const webhook = await fastify.db.insert('webhooks', {
      tenant_id: tenantId,
      name,
      url,
      events: JSON.stringify(events),
      secret,
      retry_config: JSON.stringify(retryConfig || { maxRetries: 3, retryDelay: 1000, retryMultiplier: 2 }),
      active: true,
      stats: JSON.stringify({ totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 }),
    });

    return reply.status(201).send({
      success: true,
      data: {
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          active: webhook.active,
        },
        secret, // Only shown once
      },
    });
  });

  // Update webhook
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    if (updates.events) updates.events = JSON.stringify(updates.events);
    if (updates.retryConfig) updates.retry_config = JSON.stringify(updates.retryConfig);

    const webhook = await fastify.db.update('webhooks', id, updates);

    if (!webhook) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }

    return reply.send({ success: true, data: webhook });
  });

  // Delete webhook
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Webhook deleted' } });
  });

  // Test webhook
  fastify.post('/:id/test', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const { event = 'test' } = request.body as any;

    const webhook = await fastify.db.queryOne(
      'SELECT url, secret FROM webhooks WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!webhook) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
    }

    // Queue test webhook
    await fastify.addJob('messages', 'send-webhook', {
      webhookId: id,
      tenantId,
      event,
      payload: { test: true, timestamp: new Date().toISOString() },
      url: webhook.url,
      secret: webhook.secret,
    });

    return reply.send({ success: true, data: { message: 'Test webhook sent' } });
  });

  // Get webhook deliveries
  fastify.get('/:id/deliveries', async (request, reply) => {
    const { id } = request.params as any;
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const deliveries = await fastify.db.queryMany(
      `SELECT * FROM webhook_deliveries 
       WHERE webhook_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [id, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: deliveries });
  });
}
