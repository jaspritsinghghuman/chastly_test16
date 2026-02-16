// ============================================
// API Key Routes
// Public API key management
// ============================================

import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function apiKeyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List API keys
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as any;
    const tenantId = request.user.tenantId;

    const keys = await fastify.db.queryMany(
      `SELECT id, name, key_preview, permissions, allowed_ips, rate_limit, 
              last_used_at, expires_at, created_at
       FROM api_keys
       WHERE tenant_id = $1 AND active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, (page - 1) * limit]
    );

    return reply.send({ success: true, data: keys });
  });

  // Create API key
  fastify.post('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, permissions, allowedIps, rateLimit, expiresAt } = request.body as any;

    // Generate API key
    const key = `bc_${randomBytes(32).toString('hex')}`;
    const keyPreview = `${key.slice(0, 8)}...${key.slice(-4)}`;
    const keyHash = await bcrypt.hash(key, 10);

    const apiKey = await fastify.db.insert('api_keys', {
      tenant_id: tenantId,
      name,
      key_hash: keyHash,
      key_preview: keyPreview,
      permissions: JSON.stringify(permissions || []),
      allowed_ips: allowedIps ? JSON.stringify(allowedIps) : null,
      rate_limit: rateLimit,
      expires_at: expiresAt,
      active: true,
      created_by: request.user.id,
    });

    return reply.status(201).send({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPreview: apiKey.key_preview,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expires_at,
          createdAt: apiKey.created_at,
        },
        key, // Only shown once
      },
    });
  });

  // Revoke API key
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = request.user.tenantId;

    await fastify.db.query(
      'UPDATE api_keys SET active = false WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return reply.send({ success: true, data: { message: 'API key revoked' } });
  });
}
