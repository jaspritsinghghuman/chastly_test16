// ============================================
// Analytics Routes
// Dashboard and reporting
// ============================================

import { FastifyInstance } from 'fastify';

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get dashboard overview
  fastify.get('/dashboard', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { startDate, endDate } = request.query as any;

    // Get overview stats
    const overview = await fastify.db.queryOne(
      `SELECT
        (SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL) as total_leads,
        (SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days') as new_leads,
        (SELECT COUNT(*) FROM conversations WHERE tenant_id = $1) as total_conversations,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = $1 AND direction = 'outbound') as total_messages_sent,
        (SELECT COUNT(*) FROM voice_calls WHERE tenant_id = $1) as total_calls`,
      [tenantId]
    );

    // Get channel stats
    const channelStats = await fastify.db.queryMany(
      `SELECT 
        channel,
        COUNT(*) as messages_sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read
      FROM messages
      WHERE tenant_id = $1 AND direction = 'outbound'
      GROUP BY channel`,
      [tenantId]
    );

    // Get lead source breakdown
    const leadSources = await fastify.db.queryMany(
      `SELECT source, COUNT(*) as count
       FROM leads
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY source`,
      [tenantId]
    );

    // Get recent activity
    const recentActivity = await fastify.db.queryMany(
      `SELECT 
        'message' as type,
        content as description,
        created_at,
        channel
      FROM messages
      WHERE tenant_id = $1
      UNION ALL
      SELECT 
        'lead' as type,
        first_name || ' ' || last_name as description,
        created_at,
        source as channel
      FROM leads
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
      [tenantId]
    );

    return reply.send({
      success: true,
      data: {
        overview,
        channelStats,
        leadSources,
        recentActivity,
      },
    });
  });

  // Get real-time stats
  fastify.get('/realtime', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const stats = await fastify.db.queryOne(
      `SELECT
        (SELECT COUNT(*) FROM conversations WHERE tenant_id = $1 AND status = 'active') as active_conversations,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours') as messages_today,
        (SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours') as leads_today`,
      [tenantId]
    );

    return reply.send({ success: true, data: stats });
  });

  // Get campaign performance
  fastify.get('/campaigns', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { limit = 10 } = request.query as any;

    const campaigns = await fastify.db.queryMany(
      `SELECT id, name, stats, created_at
       FROM campaigns
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return reply.send({ success: true, data: campaigns });
  });

  // Get message analytics
  fastify.get('/messages', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { days = 30 } = request.query as any;

    const dailyStats = await fastify.db.queryMany(
      `SELECT 
        DATE(created_at) as date,
        channel,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM messages
      WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), channel
      ORDER BY date DESC`,
      [tenantId]
    );

    return reply.send({ success: true, data: dailyStats });
  });

  // Export analytics report
  fastify.post('/export', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { startDate, endDate, format = 'csv' } = request.body as any;

    // Queue export job
    const job = await fastify.addJob('exports', 'analytics-report', {
      tenantId,
      startDate,
      endDate,
      format,
    });

    return reply.send({
      success: true,
      data: {
        jobId: job.id,
        message: 'Export queued. You will be notified when ready.',
      },
    });
  });
}
