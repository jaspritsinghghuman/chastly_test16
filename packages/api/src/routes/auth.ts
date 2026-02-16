// ============================================
// Auth Routes
// Authentication and user management
// ============================================

import { FastifyInstance } from 'fastify';
import { hashPassword, comparePassword } from '../plugins/auth.js';
import { config } from '../config/index.js';
import { authLogger } from '../utils/logger.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', {
    schema: {
      description: 'Register a new user',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          tenantName: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'starter', 'growth', 'enterprise'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: { type: 'object' },
                tenant: { type: 'object' },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, firstName, lastName, tenantName, plan = 'free' } = request.body as any;

    // Check if user exists
    const existingUser = await fastify.db.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'User already exists' },
      });
    }

    // Create tenant if provided
    let tenantId: string;
    let tenantSlug: string;

    if (tenantName) {
      tenantSlug = tenantName.toLowerCase().replace(/\s+/g, '-');

      // Check if tenant slug exists
      const existingTenant = await fastify.db.queryOne(
        'SELECT id FROM tenants WHERE slug = $1',
        [tenantSlug]
      );

      if (existingTenant) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ALREADY_EXISTS', message: 'Tenant name already taken' },
        });
      }

      const tenant = await fastify.db.insert('tenants', {
        name: tenantName,
        slug: tenantSlug,
        plan,
        status: 'active',
      });

      tenantId = tenant.id;
    } else {
      // Create default tenant
      tenantSlug = `tenant-${Date.now()}`;
      const tenant = await fastify.db.insert('tenants', {
        name: `${firstName}'s Workspace`,
        slug: tenantSlug,
        plan: 'free',
        status: 'active',
      });
      tenantId = tenant.id;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await fastify.db.insert('users', {
      tenant_id: tenantId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: 'admin',
      status: 'active',
      permissions: ['*'],
    });

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      { id: user.id, tenantId, role: user.role },
      { expiresIn: config.jwtExpiresIn }
    );

    const refreshToken = fastify.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: config.refreshTokenExpiresIn }
    );

    authLogger.info({ userId: user.id, tenantId }, 'User registered');

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        tenant: {
          id: tenantId,
          slug: tenantSlug,
          plan,
        },
        accessToken,
        refreshToken,
        expiresIn: 86400,
      },
    });
  });

  // Login
  fastify.post('/login', {
    schema: {
      description: 'Login user',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          tenantSlug: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, tenantSlug } = request.body as any;

    // Find user
    let userQuery = `
      SELECT u.*, t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, t.plan as tenant_plan
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = $1 AND u.status = 'active'
    `;
    const queryParams: any[] = [email.toLowerCase()];

    if (tenantSlug) {
      userQuery += ' AND t.slug = $2';
      queryParams.push(tenantSlug);
    }

    const user = await fastify.db.queryOne(userQuery, queryParams);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Verify password
    const validPassword = await comparePassword(password, user.password_hash);

    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Update last login
    await fastify.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      { id: user.id, tenantId: user.tenant_id, role: user.role },
      { expiresIn: config.jwtExpiresIn }
    );

    const refreshToken = fastify.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: config.refreshTokenExpiresIn }
    );

    authLogger.info({ userId: user.id }, 'User logged in');

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          avatar: user.avatar,
        },
        tenant: {
          id: user.tenant_id,
          slug: user.tenant_slug,
          name: user.tenant_name,
          plan: user.tenant_plan,
        },
        accessToken,
        refreshToken,
        expiresIn: 86400,
      },
    });
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as any;

    try {
      const decoded = fastify.jwt.verify(refreshToken) as any;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await fastify.db.queryOne(
        'SELECT id, tenant_id, role FROM users WHERE id = $1 AND status = $2',
        [decoded.id, 'active']
      );

      if (!user) {
        throw new Error('User not found');
      }

      const newAccessToken = fastify.jwt.sign(
        { id: user.id, tenantId: user.tenant_id, role: user.role },
        { expiresIn: config.jwtExpiresIn }
      );

      const newRefreshToken = fastify.jwt.sign(
        { id: user.id, type: 'refresh' },
        { expiresIn: config.refreshTokenExpiresIn }
      );

      return reply.send({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 86400,
        },
      });
    } catch (err) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }
  });

  // Forgot password
  fastify.post('/forgot-password', {
    schema: {
      description: 'Request password reset',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, async (request, reply) => {
    const { email } = request.body as any;

    // Find user
    const user = await fastify.db.queryOne(
      'SELECT id, first_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      // Don't reveal if email exists
      return reply.send({
        success: true,
        data: { message: 'If the email exists, a reset link has been sent' },
      });
    }

    // Generate reset token
    const resetToken = fastify.jwt.sign(
      { id: user.id, type: 'password_reset' },
      { expiresIn: '1h' }
    );

    // Store reset token (in production, send email)
    await fastify.db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
      [resetToken, user.id]
    );

    authLogger.info({ userId: user.id }, 'Password reset requested');

    return reply.send({
      success: true,
      data: { message: 'If the email exists, a reset link has been sent' },
    });
  });

  // Reset password
  fastify.post('/reset-password', {
    schema: {
      description: 'Reset password with token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { token, password } = request.body as any;

    try {
      const decoded = fastify.jwt.verify(token) as any;

      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }

      const passwordHash = await hashPassword(password);

      await fastify.db.query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
        [passwordHash, decoded.id]
      );

      authLogger.info({ userId: decoded.id }, 'Password reset successful');

      return reply.send({
        success: true,
        data: { message: 'Password reset successful' },
      });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' },
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Get current user profile',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const user = await fastify.db.queryOne(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.role, u.status, u.last_login_at,
              t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [request.user.id]
    );

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        lastLoginAt: user.last_login_at,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          slug: user.tenant_slug,
          plan: user.tenant_plan,
        },
      },
    });
  });

  // Update profile
  fastify.patch('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Update user profile',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          avatar: { type: 'string' },
          timezone: { type: 'string' },
          language: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const updates: any = {};
    const { firstName, lastName, avatar, timezone, language } = request.body as any;

    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (avatar) updates.avatar = avatar;
    if (timezone || language) {
      const currentSettings = await fastify.db.queryOne(
        'SELECT settings FROM users WHERE id = $1',
        [request.user.id]
      );
      const settings = currentSettings?.settings || {};
      if (timezone) settings.timezone = timezone;
      if (language) settings.language = language;
      updates.settings = JSON.stringify(settings);
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No updates provided' },
      });
    }

    const user = await fastify.db.update('users', request.user.id, updates);

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
      },
    });
  });

  // Change password
  fastify.post('/change-password', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Change password',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as any;

    // Get current password hash
    const user = await fastify.db.queryOne(
      'SELECT password_hash FROM users WHERE id = $1',
      [request.user.id]
    );

    // Verify current password
    const validPassword = await comparePassword(currentPassword, user.password_hash);

    if (!validPassword) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' },
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    await fastify.db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, request.user.id]
    );

    authLogger.info({ userId: request.user.id }, 'Password changed');

    return reply.send({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  });

  // Logout
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Logout user',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    // In a more complex implementation, you might blacklist the token
    authLogger.info({ userId: request.user.id }, 'User logged out');

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });
}
