// ============================================
// Campaign Routes
// Marketing campaign management
// ============================================

import { FastifyInstance } from 'fastify';

export async function campaignRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List campaigns
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, status, channel } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = 'SELECT * FROM campaigns WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (channel) {
      sql += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC`;

    const countResult = await fastify.db.queryOne(
      `SELECT COUNT(*) FROM (${sql}) AS count`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const campaigns = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  });

  // Get campaign by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const campaign = await fastify.db.queryOne(
      'SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found' },
      });
    }

    return reply.send({ success: true, data: campaign });
  });

  // Create campaign
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, description, type, channel, templateId, audience, schedule, abTest } = request.body as any;

    const campaign = await fastify.db.insert('campaigns', {
      tenant_id: tenantId,
      name,
      description,
      type,
      channel,
      template_id: templateId,
      audience: JSON.stringify(audience),
      schedule: schedule ? JSON.stringify(schedule) : null,
      ab_test: abTest ? JSON.stringify(abTest) : null,
      status: 'draft',
      stats: JSON.stringify({
        total: audience?.estimatedCount || 0,
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        clicked: 0,
        failed: 0,
      }),
      sent_by: request.user.id,
    });

    return reply.status(201).send({ success: true, data: campaign });
  });

  // Launch campaign
  fastify.post('/:id/launch', async (request, reply) => {
    const { id } = request.params as any;
    const { immediate = false } = request.body as any;
    const tenantId = request.user.tenantId;

    const campaign = await fastify.db.queryOne(
      'SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found' },
      });
    }

    // Queue campaign for processing
    await fastify.addJob('messages', 'process-campaign', {
      campaignId: id,
      tenantId,
      immediate,
    });

    // Update campaign status
    await fastify.db.query(
      "UPDATE campaigns SET status = 'running', started_at = NOW() WHERE id = $1",
      [id]
    );

    return reply.send({
      success: true,
      data: {
        message: 'Campaign launched',
        campaignId: id,
        status: 'running',
      },
    });
  });

  // Pause campaign
  fastify.post('/:id/pause', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE campaigns SET status = 'paused' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Campaign paused' } });
  });

  // Resume campaign
  fastify.post('/:id/resume', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE campaigns SET status = 'running' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Campaign resumed' } });
  });

  // Cancel campaign
  fastify.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE campaigns SET status = 'cancelled' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Campaign cancelled' } });
  });

  // Get campaign stats
  fastify.get('/:id/stats', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const campaign = await fastify.db.queryOne(
      'SELECT stats FROM campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Campaign not found' },
      });
    }

    return reply.send({ success: true, data: campaign.stats });
  });

  // Delete campaign
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Campaign deleted' } });
  });
}
