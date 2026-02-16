// ============================================
// Authentication Plugin
// JWT and API Key authentication
// ============================================

import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/index.js';
import { authLogger } from '../utils/logger.js';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT authentication hook
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check for API key first
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) {
      const validKey = await validateApiKey(request, apiKey);
      if (validKey) {
        request.user = validKey.user;
        request.tenant = validKey.tenant;
        request.apiKey = validKey.apiKey;
        return;
      }
    }

    // Fall back to JWT
    await request.jwtVerify();

    // Load user and tenant from database
    const userId = request.user.id;
    const tenantId = request.user.tenantId;

    const user = await request.db.queryOne(
      `SELECT u.*, t.slug as tenant_slug, t.name as tenant_name, t.plan as tenant_plan
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [userId]
    );

    if (!user) {
      throw new Error('User not found or inactive');
    }

    request.user = user;
    request.tenant = {
      id: user.tenant_id,
      slug: user.tenant_slug,
      name: user.tenant_name,
      plan: user.tenant_plan,
    };
  } catch (err) {
    authLogger.warn({ err, path: request.url }, 'Authentication failed');
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

// API Key validation
async function validateApiKey(
  request: FastifyRequest,
  key: string
): Promise<{ user: any; tenant: any; apiKey: any } | null> {
  try {
    // Hash the provided key for comparison
    const keyHash = await bcrypt.hash(key, 10);

    const apiKey = await request.db.queryOne(
      `SELECT ak.*, t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, t.plan as tenant_plan
       FROM api_keys ak
       JOIN tenants t ON ak.tenant_id = t.id
       WHERE ak.key_hash = $1 AND ak.active = true
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [keyHash]
    );

    if (!apiKey) return null;

    // Update last used timestamp
    await request.db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKey.id]
    );

    // Create a system user context
    const user = {
      id: apiKey.created_by,
      tenantId: apiKey.tenant_id,
      role: 'api',
      permissions: apiKey.permissions,
    };

    const tenant = {
      id: apiKey.tenant_id,
      slug: apiKey.tenant_slug,
      name: apiKey.tenant_name,
      plan: apiKey.tenant_plan,
    };

    return { user, tenant, apiKey };
  } catch (err) {
    authLogger.error({ err }, 'API key validation failed');
    return null;
  }
}

// Role-based authorization
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userRole = request.user.role;

    if (!allowedRoles.includes(userRole)) {
      authLogger.warn(
        { userId: request.user.id, role: userRole, required: allowedRoles },
        'Insufficient permissions'
      );
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }
  };
}

// Permission-based authorization
export function requirePermission(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userPermissions = request.user.permissions || [];

    // Super admin has all permissions
    if (userPermissions.includes('*')) {
      return;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      userPermissions.some((userPerm: string) =>
        matchPermission(userPerm, perm)
      )
    );

    if (!hasPermission) {
      authLogger.warn(
        { userId: request.user.id, required: requiredPermissions },
        'Missing permissions'
      );
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }
  };
}

// Permission matching with wildcards
function matchPermission(userPerm: string, requiredPerm: string): boolean {
  if (userPerm === requiredPerm) return true;
  if (userPerm === '*') return true;

  const userParts = userPerm.split(':');
  const requiredParts = requiredPerm.split(':');

  if (userParts.length !== requiredParts.length) return false;

  return userParts.every((part, i) => part === '*' || part === requiredParts[i]);
}

// Tenant context middleware
export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantSlug = request.params?.tenantSlug || request.headers['x-tenant-slug'];

  if (!tenantSlug) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Tenant slug is required',
      },
    });
  }

  const tenant = await request.db.queryOne(
    'SELECT * FROM tenants WHERE slug = $1 AND status = $2',
    [tenantSlug, 'active']
  );

  if (!tenant) {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      },
    });
  }

  request.tenant = tenant;
}

// Auth plugin
export const authPlugin = fp(async (fastify) => {
  // Decorate with auth utilities
  fastify.decorate('authenticate', authenticate);
  fastify.decorate('requireRole', requireRole);
  fastify.decorate('requirePermission', requirePermission);
  fastify.decorate('requireTenant', requireTenant);

  authLogger.info('Authentication plugin registered');
});

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
    requireRole: typeof requireRole;
    requirePermission: typeof requirePermission;
    requireTenant: typeof requireTenant;
  }

  interface FastifyRequest {
    user: any;
    tenant: any;
    apiKey?: any;
  }
}
