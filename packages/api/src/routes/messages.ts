// ============================================
// Message Routes
// Send and manage messages
// ============================================

import { FastifyInstance } from 'fastify';

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Send message
  fastify.post('/send', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { conversationId, leadId, channel, content, contentType = 'text', mediaUrl, templateId, templateVariables } = request.body as any;

    // If no conversation ID, create or get one
    let convId = conversationId;
    if (!convId && leadId) {
      const conversation = await fastify.db.queryOne(
        'SELECT id FROM conversations WHERE lead_id = $1 AND channel = $2 AND tenant_id = $3 AND status = $4',
        [leadId, channel, tenantId, 'active']
      );

      if (conversation) {
        convId = conversation.id;
      } else {
        const newConv = await fastify.db.insert('conversations', {
          tenant_id: tenantId,
          lead_id: leadId,
          channel,
          status: 'active',
          ai_enabled: true,
          unread_count: 0,
        });
        convId = newConv.id;
      }
    }

    // Create message record
    const message = await fastify.db.insert('messages', {
      tenant_id: tenantId,
      conversation_id: convId,
      channel,
      direction: 'outbound',
      content,
      content_type: contentType,
      media_url: mediaUrl,
      status: 'pending',
      template_id: templateId,
      created_by: request.user.id,
    });

    // Queue message for sending
    await fastify.addJob('messages', 'send-message', {
      messageId: message.id,
      tenantId,
      channel,
      content,
      mediaUrl,
      templateId,
      templateVariables,
    });

    // Update conversation last message
    await fastify.db.query(
      'UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1 WHERE id = $2',
      [content.substring(0, 100), convId]
    );

    // Broadcast via WebSocket
    fastify.broadcastToConversation(convId, 'message:sent', {
      messageId: message.id,
      content,
      status: 'pending',
    });

    return reply.status(201).send({ success: true, data: message });
  });

  // Send bulk messages
  fastify.post('/bulk-send', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { leadIds, channel, content, templateId, templateVariables, throttleRate = 10 } = request.body as any;

    const jobs = leadIds.map((leadId: string, index: number) => ({
      name: 'send-message',
      data: {
        tenantId,
        leadId,
        channel,
        content,
        templateId,
        templateVariables,
      },
      opts: {
        delay: index * (60000 / throttleRate), // Spread based on throttle rate
      },
    }));

    await fastify.addBulkJobs('messages', jobs);

    return reply.send({
      success: true,
      data: {
        jobCount: jobs.length,
        estimatedTime: Math.ceil(jobs.length / throttleRate),
        message: 'Messages queued for sending',
      },
    });
  });

  // Get message status
  fastify.get('/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const message = await fastify.db.queryOne(
      'SELECT id, status, sent_at, delivered_at, read_at, failed_at, fail_reason FROM messages WHERE id = $1 AND tenant_id = $2',
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

  // Mark as read
  fastify.post('/mark-read', async (request, reply) => {
    const { messageIds } = request.body as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE messages SET status = 'read', read_at = NOW() WHERE id = ANY($1) AND tenant_id = $2",
      [messageIds, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Messages marked as read' } });
  });
}
