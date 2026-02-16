// ============================================
// Conversation Routes
// Chat conversation management
// ============================================

import { FastifyInstance } from 'fastify';

export async function conversationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List conversations
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, channel, status, search } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = `
      SELECT c.*, 
        l.first_name as lead_first_name, 
        l.last_name as lead_last_name,
        l.avatar as lead_avatar
      FROM conversations c
      JOIN leads l ON c.lead_id = l.id
      WHERE c.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (channel) {
      sql += ` AND c.channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    if (status) {
      sql += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY c.last_message_at DESC NULLS LAST`;

    const countResult = await fastify.db.queryOne(
      `SELECT COUNT(*) FROM (${sql}) AS count`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const conversations = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: conversations,
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

  // Get conversation with messages
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const conversation = await fastify.db.queryOne(
      `SELECT c.*, l.first_name, l.last_name, l.email, l.phone
       FROM conversations c
       JOIN leads l ON c.lead_id = l.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );

    if (!conversation) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const messages = await fastify.db.queryMany(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [id]
    );

    // Mark as read
    await fastify.db.query(
      'UPDATE conversations SET unread_count = 0 WHERE id = $1',
      [id]
    );

    return reply.send({
      success: true,
      data: { ...conversation, messages: messages.reverse() },
    });
  });

  // Create conversation
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { leadId, channel, aiEnabled = true } = request.body as any;

    // Check if conversation already exists
    const existing = await fastify.db.queryOne(
      'SELECT id FROM conversations WHERE lead_id = $1 AND channel = $2 AND tenant_id = $3 AND status = $4',
      [leadId, channel, tenantId, 'active']
    );

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'Active conversation already exists' },
      });
    }

    const conversation = await fastify.db.insert('conversations', {
      tenant_id: tenantId,
      lead_id: leadId,
      channel,
      status: 'active',
      ai_enabled: aiEnabled,
      unread_count: 0,
    });

    return reply.status(201).send({ success: true, data: conversation });
  });

  // Close conversation
  fastify.post('/:id/close', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE conversations SET status = 'closed', closed_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Conversation closed' } });
  });

  // Assign conversation
  fastify.post('/:id/assign', async (request, reply) => {
    const { id } = request.params as any;
    const { userId } = request.body as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'UPDATE conversations SET assigned_to = $1 WHERE id = $2 AND tenant_id = $3',
      [userId, id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Conversation assigned' } });
  });
}
