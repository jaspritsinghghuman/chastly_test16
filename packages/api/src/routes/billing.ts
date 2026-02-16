// ============================================
// Billing Routes
// Subscription and billing management
// ============================================

import { FastifyInstance } from 'fastify';

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get subscription
  fastify.get('/subscription', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const subscription = await fastify.db.queryOne(
      `SELECT s.*, p.name as plan_name, p.price, p.currency
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.tenant_id = $1`,
      [tenantId]
    );

    if (!subscription) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No subscription found' },
      });
    }

    // Get current usage
    const usage = await fastify.db.queryOne(
      `SELECT 
        (SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL) as contacts,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', NOW())) as messages_sent,
        (SELECT COALESCE(SUM(duration), 0) FROM voice_calls WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', NOW())) as voice_minutes`,
      [tenantId]
    );

    return reply.send({
      success: true,
      data: {
        subscription,
        usage,
      },
    });
  });

  // Update subscription
  fastify.post('/subscription', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { planId, billingCycle = 'monthly' } = request.body as any;

    // Get plan details
    const plan = await fastify.db.queryOne(
      'SELECT * FROM plans WHERE id = $1',
      [planId]
    );

    if (!plan) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Plan not found' },
      });
    }

    // Update or create subscription
    const existingSub = await fastify.db.queryOne(
      'SELECT id FROM subscriptions WHERE tenant_id = $1',
      [tenantId]
    );

    if (existingSub) {
      await fastify.db.query(
        `UPDATE subscriptions 
         SET plan_id = $1, billing_cycle = $2, updated_at = NOW()
         WHERE tenant_id = $3`,
        [planId, billingCycle, tenantId]
      );
    } else {
      await fastify.db.insert('subscriptions', {
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: billingCycle,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Update tenant plan
    await fastify.db.query(
      'UPDATE tenants SET plan = $1 WHERE id = $2',
      [plan.name.toLowerCase(), tenantId]
    );

    return reply.send({
      success: true,
      data: { message: 'Subscription updated' },
    });
  });

  // Get invoices
  fastify.get('/invoices', async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const invoices = await fastify.db.queryMany(
      'SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [tenantId, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: invoices });
  });

  // Get quota usage
  fastify.get('/quota', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const quotas = await fastify.db.queryMany(
      'SELECT * FROM quota_usage WHERE tenant_id = $1',
      [tenantId]
    );

    return reply.send({ success: true, data: quotas });
  });
}
