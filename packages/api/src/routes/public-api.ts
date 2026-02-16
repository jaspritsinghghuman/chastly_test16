// ============================================
// Public API Routes
// External API endpoints for developers
// ============================================

import { FastifyInstance } from 'fastify';

export async function publicApiRoutes(fastify: FastifyInstance) {
  // All routes require API key authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // Create lead via API
  fastify.post('/leads', {
    schema: {
      description: 'Create a new lead via API',
      tags: ['Public API'],
      security: [{ apiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const tenantId = request.tenant.id;
    const { firstName, lastName, email, phone, source = 'api', tags, customFields } = request.body as any;

    const lead = await fastify.db.insert('leads', {
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source,
      tags: tags || [],
      custom_fields: customFields || {},
      status: 'new',
      score_total: 0,
    });

    // Trigger webhook
    await fastify.addJob('messages', 'send-webhook', {
      tenantId,
      event: 'lead.created',
      payload: { leadId: lead.id, email, source },
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: lead.id,
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        status: lead.status,
        createdAt: lead.created_at,
      },
    });
  });

  // Get lead by ID
  fastify.get('/leads/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.tenant.id;

    const lead = await fastify.db.queryOne(
      'SELECT id, first_name, last_name, email, phone, company, status, source, tags, custom_fields, created_at FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: lead.id,
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        source: lead.source,
        tags: lead.tags,
        customFields: lead.custom_fields,
        createdAt: lead.created_at,
      },
    });
  });

  // Update lead
  fastify.patch('/leads/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.tenant.id;
    const updates = request.body as any;

    const lead = await fastify.db.update('leads', id, updates);

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      });
    }

    // Trigger webhook
    await fastify.addJob('messages', 'send-webhook', {
      tenantId,
      event: 'lead.updated',
      payload: { leadId: id, updates },
    });

    return reply.send({ success: true, data: lead });
  });

  // Send message
  fastify.post('/messages', async (request, reply) => {
    const tenantId = request.tenant.id;
    const { leadId, channel, content, templateId, templateVariables } = request.body as any;

    // Get or create conversation
    let conversation = await fastify.db.queryOne(
      'SELECT id FROM conversations WHERE lead_id = $1 AND channel = $2 AND tenant_id = $3 AND status = $4',
      [leadId, channel, tenantId, 'active']
    );

    if (!conversation) {
      const newConv = await fastify.db.insert('conversations', {
        tenant_id: tenantId,
        lead_id: leadId,
        channel,
        status: 'active',
        ai_enabled: false,
        unread_count: 0,
      });
      conversation = { id: newConv.id };
    }

    // Create message
    const message = await fastify.db.insert('messages', {
      tenant_id: tenantId,
      conversation_id: conversation.id,
      channel,
      direction: 'outbound',
      content,
      status: 'pending',
      template_id: templateId,
    });

    // Queue for sending
    await fastify.addJob('messages', 'send-message', {
      messageId: message.id,
      tenantId,
      channel,
      content,
      templateId,
      templateVariables,
    });

    return reply.status(201).send({
      success: true,
      data: {
        messageId: message.id,
        status: 'pending',
        conversationId: conversation.id,
      },
    });
  });

  // Get message status
  fastify.get('/messages/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.tenant.id;

    const message = await fastify.db.queryOne(
      'SELECT id, status, sent_at, delivered_at, read_at FROM messages WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!message) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
    }

    return reply.send({ success: true, data: message });
  });

  // Trigger workflow
  fastify.post('/workflows/:id/trigger', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.tenant.id;
    const { leadId, data } = request.body as any;

    // Verify workflow exists and is active
    const workflow = await fastify.db.queryOne(
      "SELECT id FROM workflows WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
      [id, tenantId]
    );

    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found or not active' },
      });
    }

    // Execute workflow
    const execution = await fastify.workflowEngine.execute(id, {
      tenantId,
      leadId,
      triggerData: data,
    });

    return reply.send({
      success: true,
      data: {
        executionId: execution.id,
        status: execution.status,
      },
    });
  });
}
