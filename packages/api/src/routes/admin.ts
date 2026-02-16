// ============================================
// Admin Routes
// Platform-level settings (Admin only)
// ============================================

import { FastifyInstance } from 'fastify';
import { createAdminService, SETTING_CATEGORIES } from '../services/admin.service';

// Admin middleware - check if user is admin
async function requireAdmin(fastify: FastifyInstance, request: any, reply: any) {
  if (request.user.role !== 'admin' && request.user.role !== 'superadmin') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required'
    });
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', async (request, reply) => {
    await requireAdmin(fastify, request, reply);
  });

  const adminService = createAdminService(fastify);

  // ============================================
  // System Status
  // ============================================

  // Get system overview
  fastify.get('/status', async (request, reply) => {
    const status = await adminService.getSystemStatus();
    return reply.send({ success: true, data: status });
  });

  // ============================================
  // Admin Settings
  // ============================================

  // Get all settings
  fastify.get('/settings', async (request, reply) => {
    const { category } = request.query as { category?: string };
    
    if (category && !SETTING_CATEGORIES.includes(category as any)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid category. Must be one of: ${SETTING_CATEGORIES.join(', ')}`
      });
    }

    const settings = await adminService.getAllSettings(category as any);
    return reply.send({ success: true, data: settings });
  });

  // Get settings by category
  fastify.get('/settings/category/:category', async (request, reply) => {
    const { category } = request.params as { category: string };
    
    if (!SETTING_CATEGORIES.includes(category as any)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid category. Must be one of: ${SETTING_CATEGORIES.join(', ')}`
      });
    }

    const settings = await adminService.getSettingsByCategory(category as any);
    return reply.send({ success: true, data: settings });
  });

  // Get single setting
  fastify.get('/settings/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const setting = await adminService.getSetting(key);

    if (!setting) {
      return reply.status(404).send({
        success: false,
        error: 'Setting not found'
      });
    }

    return reply.send({ success: true, data: setting });
  });

  // Update setting
  fastify.patch('/settings/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: string };

    if (value === undefined) {
      return reply.status(400).send({
        success: false,
        error: 'Value is required'
      });
    }

    try {
      const setting = await adminService.updateSetting(key, value, request.user.userId);
      
      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found'
        });
      }

      return reply.send({ success: true, data: setting });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Create new setting
  fastify.post('/settings', async (request, reply) => {
    const {
      key,
      value,
      valueType = 'string',
      category,
      description,
      isEncrypted = false,
      isEditable = true
    } = request.body as any;

    if (!key || !category) {
      return reply.status(400).send({
        success: false,
        error: 'Key and category are required'
      });
    }

    if (!SETTING_CATEGORIES.includes(category)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid category. Must be one of: ${SETTING_CATEGORIES.join(', ')}`
      });
    }

    try {
      const setting = await adminService.createSetting(
        key,
        value,
        valueType,
        category,
        description,
        isEncrypted,
        isEditable
      );

      return reply.status(201).send({ success: true, data: setting });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Delete setting
  fastify.delete('/settings/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const deleted = await adminService.deleteSetting(key);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Setting not found'
      });
    }

    return reply.send({ success: true, data: { message: 'Setting deleted' } });
  });

  // ============================================
  // Platform Payment Gateways
  // ============================================

  // Get all payment gateways
  fastify.get('/payment-gateways', async (request, reply) => {
    const gateways = await adminService.getPaymentGateways();
    return reply.send({ success: true, data: gateways });
  });

  // Get payment gateway by ID
  fastify.get('/payment-gateways/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const gateway = await adminService.getPaymentGatewayById(id);

    if (!gateway) {
      return reply.status(404).send({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    return reply.send({ success: true, data: gateway });
  });

  // Create payment gateway
  fastify.post('/payment-gateways', async (request, reply) => {
    const {
      provider,
      name,
      credentials,
      config,
      isDefault = false,
      webhookEndpoint
    } = request.body as any;

    if (!provider || !name || !credentials) {
      return reply.status(400).send({
        success: false,
        error: 'Provider, name, and credentials are required'
      });
    }

    try {
      const gateway = await adminService.createPaymentGateway(
        provider,
        name,
        credentials,
        config,
        isDefault,
        webhookEndpoint
      );

      return reply.status(201).send({ success: true, data: gateway });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Update payment gateway
  fastify.patch('/payment-gateways/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const gateway = await adminService.updatePaymentGateway(id, updates);

    if (!gateway) {
      return reply.status(404).send({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    return reply.send({ success: true, data: gateway });
  });

  // Delete payment gateway
  fastify.delete('/payment-gateways/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminService.deletePaymentGateway(id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    return reply.send({ success: true, data: { message: 'Payment gateway deleted' } });
  });

  // ============================================
  // Global Fallback Providers
  // ============================================

  // Get all fallback providers
  fastify.get('/fallback-providers', async (request, reply) => {
    const { channel } = request.query as { channel?: string };
    const providers = await adminService.getFallbackProviders(channel);
    return reply.send({ success: true, data: providers });
  });

  // Create fallback provider
  fastify.post('/fallback-providers', async (request, reply) => {
    const {
      channel,
      provider,
      credentials,
      priority = 1,
      config
    } = request.body as any;

    if (!channel || !provider || !credentials) {
      return reply.status(400).send({
        success: false,
        error: 'Channel, provider, and credentials are required'
      });
    }

    try {
      const fallbackProvider = await adminService.createFallbackProvider(
        channel,
        provider,
        credentials,
        priority,
        config
      );

      return reply.status(201).send({ success: true, data: fallbackProvider });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Update fallback provider
  fastify.patch('/fallback-providers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const provider = await adminService.updateFallbackProvider(id, updates);

    if (!provider) {
      return reply.status(404).send({
        success: false,
        error: 'Fallback provider not found'
      });
    }

    return reply.send({ success: true, data: provider });
  });

  // Delete fallback provider
  fastify.delete('/fallback-providers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminService.deleteFallbackProvider(id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Fallback provider not found'
      });
    }

    return reply.send({ success: true, data: { message: 'Fallback provider deleted' } });
  });

  // ============================================
  // Tenant Management (Admin)
  // ============================================

  // Get all tenants
  fastify.get('/tenants', async (request, reply) => {
    const { page = '1', limit = '20', status } = request.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM leads WHERE tenant_id = t.id) as lead_count,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = t.id) as message_count
      FROM tenants t
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const tenants = await fastify.db.queryMany(query, params);

    // Get total count
    const countResult = await fastify.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM tenants ${status ? 'WHERE status = $1' : ''}`,
      status ? [status] : []
    );

    return reply.send({
      success: true,
      data: {
        tenants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult?.count || '0')
        }
      }
    });
  });

  // Get tenant by ID
  fastify.get('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const tenant = await fastify.db.queryOne(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM leads WHERE tenant_id = t.id) as lead_count,
        (SELECT COUNT(*) FROM messages WHERE tenant_id = t.id) as message_count,
        (SELECT COUNT(*) FROM campaigns WHERE tenant_id = t.id) as campaign_count,
        (SELECT COUNT(*) FROM workflows WHERE tenant_id = t.id) as workflow_count
       FROM tenants t
       WHERE t.id = $1`,
      [id]
    );

    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: 'Tenant not found'
      });
    }

    return reply.send({ success: true, data: tenant });
  });

  // Update tenant
  fastify.patch('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const allowedUpdates = ['name', 'plan', 'status', 'max_contacts', 'max_messages_per_day', 'max_workflows', 'max_team_members', 'settings', 'branding', 'whitelabel_enabled', 'custom_domain'];
    const filteredUpdates: any = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (['settings', 'branding'].includes(key)) {
          filteredUpdates[key] = JSON.stringify(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'No valid updates provided'
      });
    }

    filteredUpdates.updated_at = new Date();

    const tenant = await fastify.db.update('tenants', id, filteredUpdates);

    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: 'Tenant not found'
      });
    }

    return reply.send({ success: true, data: tenant });
  });

  // Suspend/Activate tenant
  fastify.post('/tenants/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'active' | 'suspended' | 'inactive' };

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid status. Must be: active, suspended, or inactive'
      });
    }

    const tenant = await fastify.db.update('tenants', id, {
      status,
      updated_at: new Date()
    });

    if (!tenant) {
      return reply.status(404).send({
        success: false,
        error: 'Tenant not found'
      });
    }

    return reply.send({
      success: true,
      data: { message: `Tenant ${status === 'active' ? 'activated' : status}` }
    });
  });

  // ============================================
  // User Management (Admin)
  // ============================================

  // Get all users (across all tenants)
  fastify.get('/users', async (request, reply) => {
    const { page = '1', limit = '20', tenantId, role } = request.query as {
      page?: string;
      limit?: string;
      tenantId?: string;
      role?: string;
    };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.*, t.name as tenant_name
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (tenantId) {
      query += ` AND u.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }

    if (role) {
      query += ` AND u.role = $${params.length + 1}`;
      params.push(role);
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const users = await fastify.db.queryMany(query, params);

    return reply.send({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  });

  // Impersonate user (login as user)
  fastify.post('/users/:id/impersonate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await fastify.db.queryOne(
      'SELECT id, tenant_id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'User not found'
      });
    }

    // Generate impersonation token
    const token = fastify.jwt.sign({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      impersonatedBy: request.user.userId,
      type: 'impersonation'
    }, { expiresIn: '1h' });

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenant_id
        }
      }
    });
  });

  // ============================================
  // Analytics & Reports
  // ============================================

  // Get platform-wide analytics
  fastify.get('/analytics', async (request, reply) => {
    const { days = '30' } = request.query as { days?: string };

    const [
      messageStats,
      leadStats,
      tenantGrowth,
      revenueStats
    ] = await Promise.all([
      // Message stats
      fastify.db.queryOne<{ total: string; sent: string; delivered: string; failed: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
         FROM messages
         WHERE created_at > NOW() - INTERVAL '${days} days'`
      ),
      // Lead stats
      fastify.db.queryOne<{ total: string; new: string; qualified: string; converted: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new,
          COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted
         FROM leads
         WHERE created_at > NOW() - INTERVAL '${days} days'`
      ),
      // Tenant growth
      fastify.db.queryMany<{ date: string; count: string }>(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM tenants
         WHERE created_at > NOW() - INTERVAL '${days} days'
         GROUP BY DATE(created_at)
         ORDER BY date`
      ),
      // Revenue (from invoices)
      fastify.db.queryOne<{ total: string; paid: string; pending: string }>(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending
         FROM invoices
         WHERE created_at > NOW() - INTERVAL '${days} days'`
      )
    ]);

    return reply.send({
      success: true,
      data: {
        messages: {
          total: parseInt(messageStats?.total || '0'),
          sent: parseInt(messageStats?.sent || '0'),
          delivered: parseInt(messageStats?.delivered || '0'),
          failed: parseInt(messageStats?.failed || '0')
        },
        leads: {
          total: parseInt(leadStats?.total || '0'),
          new: parseInt(leadStats?.new || '0'),
          qualified: parseInt(leadStats?.qualified || '0'),
          converted: parseInt(leadStats?.converted || '0')
        },
        tenantGrowth: tenantGrowth.map(t => ({
          date: t.date,
          count: parseInt(t.count)
        })),
        revenue: {
          total: parseFloat(revenueStats?.total || '0'),
          paid: parseFloat(revenueStats?.paid || '0'),
          pending: parseFloat(revenueStats?.pending || '0')
        }
      }
    });
  });
}
