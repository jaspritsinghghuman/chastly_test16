// ============================================
// Team Routes
// Team member management
// ============================================

import { FastifyInstance } from 'fastify';
import { hashPassword } from '../plugins/auth.js';

export async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List team members
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20, role, search } = request.query as any;
    const tenantId = request.user.tenantId;

    let sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.role, u.status, u.last_login_at,
             tm.department, tm.assigned_channels, tm.max_concurrent_chats, tm.working_hours
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id
      WHERE u.tenant_id = $1 AND u.status != 'deleted'
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (role) {
      sql += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY u.created_at DESC`;

    const countResult = await fastify.db.queryOne(
      `SELECT COUNT(*) FROM (${sql}) AS count`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const members = await fastify.db.queryMany(sql, params);

    return reply.send({
      success: true,
      data: members,
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

  // Invite team member
  fastify.post('/invite', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { email, firstName, lastName, role, permissions, department } = request.body as any;

    // Check if user already exists
    const existingUser = await fastify.db.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'User with this email already exists' },
      });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await hashPassword(tempPassword);

    // Create user
    const user = await fastify.db.insert('users', {
      tenant_id: tenantId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role,
      permissions: permissions || [],
      status: 'pending',
    });

    // Create team member record
    await fastify.db.insert('team_members', {
      tenant_id: tenantId,
      user_id: user.id,
      department,
      assigned_channels: [],
      max_concurrent_chats: 5,
    });

    // TODO: Send invitation email

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          status: user.status,
        },
        tempPassword, // Remove in production - only for testing
      },
    });
  });

  // Update team member
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;
    const { role, permissions, department, assignedChannels, maxConcurrentChats } = request.body as any;

    // Update user
    if (role || permissions) {
      await fastify.db.update('users', id, {
        role,
        permissions: permissions ? JSON.stringify(permissions) : undefined,
      });
    }

    // Update team member
    if (department || assignedChannels || maxConcurrentChats) {
      await fastify.db.query(
        `INSERT INTO team_members (tenant_id, user_id, department, assigned_channels, max_concurrent_chats)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET
           department = EXCLUDED.department,
           assigned_channels = EXCLUDED.assigned_channels,
           max_concurrent_chats = EXCLUDED.max_concurrent_chats`,
        [tenantId, id, department, JSON.stringify(assignedChannels || []), maxConcurrentChats]
      );
    }

    return reply.send({ success: true, data: { message: 'Team member updated' } });
  });

  // Remove team member
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      "UPDATE users SET status = 'deleted' WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'Team member removed' } });
  });
}
