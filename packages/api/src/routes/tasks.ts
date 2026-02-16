// ============================================
// Task Routes
// Task management for team collaboration
// ============================================

import { FastifyInstance } from 'fastify';

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List tasks
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, status, priority, assignedTo, leadId } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = `
      SELECT t.*, 
        u.first_name as assigned_first_name, 
        u.last_name as assigned_last_name,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN leads l ON t.lead_id = l.id
      WHERE t.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      sql += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (assignedTo) {
      sql += ` AND t.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    if (leadId) {
      sql += ` AND t.lead_id = $${paramIndex}`;
      params.push(leadId);
      paramIndex++;
    }

    sql += ` ORDER BY 
      CASE t.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      t.due_at ASC NULLS LAST,
      t.created_at DESC
    `;

    const countResult = await fastify.db.queryOne(
      `SELECT COUNT(*) FROM (${sql}) AS count`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const tasks = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: tasks,
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

  // Get task by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const task = await fastify.db.queryOne(
      'SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
    }

    return reply.send({ success: true, data: task });
  });

  // Create task
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { title, description, priority = 'medium', assignedTo, leadId, conversationId, dueAt } = request.body as any;

    const task = await fastify.db.insert('tasks', {
      tenant_id: tenantId,
      title,
      description,
      priority,
      assigned_to: assignedTo,
      lead_id: leadId,
      conversation_id: conversationId,
      due_at: dueAt,
      status: 'pending',
      created_by: request.user.id,
    });

    // Notify assigned user
    if (assignedTo) {
      fastify.broadcastToUser(assignedTo, 'task:assigned', {
        taskId: task.id,
        title,
      });
    }

    return reply.status(201).send({ success: true, data: task });
  });

  // Update task
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    const task = await fastify.db.update('tasks', id, updates);

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
    }

    return reply.send({ success: true, data: task });
  });

  // Complete task
  fastify.post('/:id/complete', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const task = await fastify.db.update('tasks', id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
    }

    return reply.send({ success: true, data: { message: 'Task completed' } });
  });

  // Delete task
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM tasks WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Task deleted' } });
  });
}
