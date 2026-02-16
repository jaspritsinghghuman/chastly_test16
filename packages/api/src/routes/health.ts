// ============================================
// Health Routes
// Health checks and system status
// ============================================

import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  });

  // Detailed health check
  fastify.get('/detailed', {
    schema: {
      description: 'Detailed health check with service status',
      tags: ['Health'],
    },
  }, async () => {
    const checks: any = {
      api: { status: 'healthy', responseTime: 0 },
      database: { status: 'unknown', responseTime: 0 },
      redis: { status: 'unknown', responseTime: 0 },
    };

    // Check database
    const dbStart = Date.now();
    try {
      await fastify.db.query('SELECT 1');
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStart,
        error: 'Database connection failed',
      };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await fastify.queues.messages.client.ping();
      checks.redis = {
        status: 'healthy',
        responseTime: Date.now() - redisStart,
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        responseTime: Date.now() - redisStart,
        error: 'Redis connection failed',
      };
    }

    const allHealthy = Object.values(checks).every((check: any) => check.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks,
    };
  });

  // Readiness check
  fastify.get('/ready', {
    schema: {
      description: 'Kubernetes readiness probe',
      tags: ['Health'],
    },
  }, async (request, reply) => {
    try {
      await fastify.db.query('SELECT 1');
      return { status: 'ready' };
    } catch (error) {
      reply.status(503);
      return { status: 'not ready', error: 'Database connection failed' };
    }
  });

  // Liveness check
  fastify.get('/live', {
    schema: {
      description: 'Kubernetes liveness probe',
      tags: ['Health'],
    },
  }, async () => {
    return { status: 'alive' };
  });
}
