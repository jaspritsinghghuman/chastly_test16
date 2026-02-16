// ============================================
// Template Routes
// Message template management
// ============================================

import { FastifyInstance } from 'fastify';

export async function templateRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List templates
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, channel, category, search } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = 'SELECT * FROM message_templates WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (channel) {
      sql += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY usage_count DESC, created_at DESC`;

    const countResult = await fastify.db.queryOne(
      `SELECT COUNT(*) FROM (${sql}) AS count`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const templates = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: templates,
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

  // Get template by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const template = await fastify.db.queryOne(
      'SELECT * FROM message_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    return reply.send({ success: true, data: template });
  });

  // Create template
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, description, category, channel, language, content, variables, header, buttons, footer } = request.body as any;

    const template = await fastify.db.insert('message_templates', {
      tenant_id: tenantId,
      name,
      description,
      category,
      channel,
      language: language || 'en',
      content,
      variables: JSON.stringify(variables || []),
      header: header ? JSON.stringify(header) : null,
      buttons: buttons ? JSON.stringify(buttons) : null,
      footer,
      usage_count: 0,
      is_public: false,
      created_by: request.user.id,
    });

    return reply.status(201).send({ success: true, data: template });
  });

  // Update template
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    // Serialize JSON fields
    if (updates.variables) updates.variables = JSON.stringify(updates.variables);
    if (updates.header) updates.header = JSON.stringify(updates.header);
    if (updates.buttons) updates.buttons = JSON.stringify(updates.buttons);

    const template = await fastify.db.update('message_templates', id, updates);

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    return reply.send({ success: true, data: template });
  });

  // Delete template
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'DELETE FROM message_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Template deleted' } });
  });

  // Preview template
  fastify.post('/:id/preview', async (request, reply) => {
    const { id } = request.params as any;
    const { variables } = request.body as any;
    const tenantId = request.user.tenantId;

    const template = await fastify.db.queryOne(
      'SELECT content, header, footer FROM message_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    // Replace variables in content
    let content = template.content;
    for (const [key, value] of Object.entries(variables || {})) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return reply.send({
      success: true,
      data: {
        content,
        header: template.header,
        footer: template.footer,
      },
    });
  });
}
