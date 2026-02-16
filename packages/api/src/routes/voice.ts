// ============================================
// Voice Routes
// AI voice calling management
// ============================================

import { FastifyInstance } from 'fastify';

export async function voiceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List calls
  fastify.get('/calls', async (request, reply) => {
    const { page = 1, limit = 20, leadId, status } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = 'SELECT * FROM voice_calls WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (leadId) {
      sql += ` AND lead_id = $${paramIndex}`;
      params.push(leadId);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
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

    const calls = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: calls,
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

  // Make call
  fastify.post('/calls', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { leadId, scriptId, customScript, aiEnabled = true } = request.body as any;

    // Get lead phone number
    const lead = await fastify.db.queryOne(
      'SELECT phone, first_name, last_name FROM leads WHERE id = $1 AND tenant_id = $2',
      [leadId, tenantId]
    );

    if (!lead || !lead.phone) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Lead not found or has no phone number' },
      });
    }

    // Get script if provided
    let script = customScript;
    if (scriptId) {
      const scriptRecord = await fastify.db.queryOne(
        'SELECT * FROM call_scripts WHERE id = $1 AND tenant_id = $2',
        [scriptId, tenantId]
      );
      if (scriptRecord) {
        script = scriptRecord.ai_prompt;
      }
    }

    // Create call record
    const call = await fastify.db.insert('voice_calls', {
      tenant_id: tenantId,
      lead_id: leadId,
      direction: 'outbound',
      status: 'queued',
      to_number: lead.phone,
      from_number: process.env.TWILIO_FROM_NUMBER,
      ai_enabled: aiEnabled,
      ai_script: script,
    });

    // Queue call for processing
    await fastify.addJob('voice', 'make-call', {
      callId: call.id,
      tenantId,
      leadId,
      phoneNumber: lead.phone,
      script,
      aiEnabled,
    });

    return reply.status(201).send({ success: true, data: call });
  });

  // Get call by ID
  fastify.get('/calls/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const call = await fastify.db.queryOne(
      'SELECT * FROM voice_calls WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!call) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Call not found' },
      });
    }

    return reply.send({ success: true, data: call });
  });

  // List call scripts
  fastify.get('/scripts', async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const scripts = await fastify.db.queryMany(
      'SELECT * FROM call_scripts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [tenantId, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: scripts });
  });

  // Create call script
  fastify.post('/scripts', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, greeting, talkingPoints, questions, objections, closing, aiPrompt, voice, language } = request.body as any;

    const script = await fastify.db.insert('call_scripts', {
      tenant_id: tenantId,
      name,
      greeting,
      talking_points: JSON.stringify(talkingPoints || []),
      questions: JSON.stringify(questions || []),
      objections: JSON.stringify(objections || {}),
      closing,
      ai_prompt: aiPrompt,
      voice: voice || 'alloy',
      language: language || 'en',
    });

    return reply.status(201).send({ success: true, data: script });
  });

  // Update call script
  fastify.patch('/scripts/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    // Serialize JSON fields
    if (updates.talkingPoints) updates.talking_points = JSON.stringify(updates.talkingPoints);
    if (updates.questions) updates.questions = JSON.stringify(updates.questions);
    if (updates.objections) updates.objections = JSON.stringify(updates.objections);

    const script = await fastify.db.update('call_scripts', id, updates);

    if (!script) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Script not found' },
      });
    }

    return reply.send({ success: true, data: script });
  });

  // Delete call script
  fastify.delete('/scripts/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM call_scripts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Script deleted' } });
  });
}
