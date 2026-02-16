// ============================================
// Workflow Routes
// Automation workflow management
// ============================================

import { FastifyInstance } from 'fastify';

export async function workflowRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List workflows
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, status } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = 'SELECT * FROM workflows WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

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

    const workflows = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: workflows,
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

  // Get workflow by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const workflow = await fastify.db.queryOne(
      'SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    return reply.send({ success: true, data: workflow });
  });

  // Create workflow
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, description, trigger, nodes, edges } = request.body as any;

    const workflow = await fastify.db.insert('workflows', {
      tenant_id: tenantId,
      name,
      description,
      trigger: JSON.stringify(trigger),
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      status: 'draft',
      created_by: request.user.id,
    });

    return reply.status(201).send({ success: true, data: workflow });
  });

  // Update workflow
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    // Serialize JSON fields
    if (updates.trigger) updates.trigger = JSON.stringify(updates.trigger);
    if (updates.nodes) updates.nodes = JSON.stringify(updates.nodes);
    if (updates.edges) updates.edges = JSON.stringify(updates.edges);

    const workflow = await fastify.db.update('workflows', id, updates);

    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    return reply.send({ success: true, data: workflow });
  });

  // Activate workflow
  fastify.post('/:id/activate', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE workflows SET status = 'active' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Workflow activated' } });
  });

  // Deactivate workflow
  fastify.post('/:id/deactivate', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE workflows SET status = 'paused' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Workflow deactivated' } });
  });

  // Delete workflow
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM workflows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Workflow deleted' } });
  });

  // Test workflow
  fastify.post('/:id/test', async (request, reply) => {
    const { id } = request.params as any;
    const { leadId, testData } = request.body as any;
    const tenantId = request.user.tenantId;

    // Trigger workflow execution
    const execution = await fastify.workflowEngine.execute(id, {
      tenantId,
      leadId,
      testData,
    });

    return reply.send({ success: true, data: execution });
  });

  // Get workflow executions
  fastify.get('/:id/executions', async (request, reply) => {
    const { id } = request.params as any;
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const executions = await fastify.db.queryMany(
      `SELECT * FROM workflow_executions 
       WHERE workflow_id = $1 AND tenant_id = $2 
       ORDER BY started_at DESC 
       LIMIT $3 OFFSET $4`,
      [id, tenantId, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: executions });
  });
}
