// ============================================
// Lead Routes
// Lead management and operations
// ============================================

import { FastifyInstance } from 'fastify';

export async function leadRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  // List leads
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, search, status, source, tags } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = 'SELECT * FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (search) {
      sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (source) {
      sql += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    const countResult = await fastify.db.queryOne(`SELECT COUNT(*) FROM (${sql}) AS count`, params);
    const total = parseInt(countResult?.count || '0');

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const leads = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: leads,
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

  // Get lead by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    const lead = await fastify.db.queryOne(
      'SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      });
    }

    return reply.send({ success: true, data: lead });
  });

  // Create lead
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { firstName, lastName, email, phone, company, source = 'manual', tags, customFields } = request.body as any;

    const lead = await fastify.db.insert('leads', {
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      company,
      source,
      tags: tags || [],
      custom_fields: customFields || {},
      status: 'new',
      score_total: 0,
    });

    // Trigger AI qualification if enabled
    if (fastify.ai && email) {
      fastify.addJob('ai', 'qualify-lead', {
        leadId: lead.id,
        tenantId,
        leadData: { firstName, lastName, email, phone, company, source },
      });
    }

    return reply.status(201).send({ success: true, data: lead });
  });

  // Update lead
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const updates = request.body as any;

    const lead = await fastify.db.update('leads', id, updates);

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      });
    }

    return reply.send({ success: true, data: lead });
  });

  // Delete lead
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'UPDATE leads SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Lead deleted' } });
  });

  // Bulk operations
  fastify.post('/bulk-update', async (request, reply) => {
    const { leadIds, updates } = request.body as any;
    const tenantId = request.user.tenantId;

    const result = await fastify.db.query(
      `UPDATE leads SET ${Object.keys(updates).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
       WHERE id = ANY($1) AND tenant_id = $2`,
      [leadIds, tenantId, ...Object.values(updates)]
    );

    return reply.send({
      success: true,
      data: { updated: result.rowCount },
    });
  });

  // Get lead stats
  fastify.get('/stats/overview', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const stats = await fastify.db.queryOne(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
      FROM leads
      WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );

    return reply.send({ success: true, data: stats });
  });
}
