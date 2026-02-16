#!/usr/bin/env node
// ============================================
// BeeCastly API Server
// Fastify-based backend for omnichannel automation
// ============================================

import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

// Plugins
import { databasePlugin } from './plugins/database.js';
import { authPlugin } from './plugins/auth.js';
import { queuePlugin } from './plugins/queue.js';
import { aiPlugin } from './plugins/ai.js';
import { socketPlugin } from './plugins/socket.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { leadRoutes } from './routes/leads.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { workflowRoutes } from './routes/workflows.js';
import { campaignRoutes } from './routes/campaigns.js';
import { voiceRoutes } from './routes/voice.js';
import { templateRoutes } from './routes/templates.js';
import { analyticsRoutes } from './routes/analytics.js';
import { teamRoutes } from './routes/team.js';
import { taskRoutes } from './routes/tasks.js';
import { billingRoutes } from './routes/billing.js';
import { settingsRoutes } from './routes/settings.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { webhookRoutes } from './routes/webhooks.js';
import { publicApiRoutes } from './routes/public-api.js';
import { healthRoutes } from './routes/health.js';

// Services
import { MessageQueue } from './services/queue/message-queue.js';
import { WorkflowEngine } from './services/workflow/workflow-engine.js';
import { AntiBanService } from './services/anti-ban/anti-ban-service.js';
import { LeadScoringService } from './services/ai/lead-scoring.js';
import { AnalyticsService } from './services/analytics/analytics.js';

const app = fastify({
  logger: logger,
  trustProxy: true,
});

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal Server Error' : error.message;

  reply.status(statusCode).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
});

// Not found handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    },
  });
});

async function start() {
  try {
    // Register security plugins
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    await app.register(cors, {
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-ID'],
    });

    // Register rate limiting
    await app.register(rateLimit, {
      max: 1000,
      timeWindow: '1 hour',
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      errorResponseBuilder: (req, context) => ({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${context.after}`,
        },
      }),
    });

    // Register JWT
    await app.register(jwt, {
      secret: config.jwtSecret,
      decode: { complete: true },
    });

    // Register WebSocket
    await app.register(websocket);

    // Register Swagger documentation
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'BeeCastly API',
          description: 'AI-powered omnichannel sales and marketing automation platform',
          version: '1.0.0',
          contact: {
            name: 'BeeCastly Support',
            email: 'support@beecastly.com',
          },
        },
        servers: [
          {
            url: config.apiUrl,
            description: 'API Server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });

    // Register custom plugins
    await app.register(databasePlugin);
    await app.register(authPlugin);
    await app.register(queuePlugin);
    await app.register(aiPlugin);
    await app.register(socketPlugin);

    // Register routes
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(leadRoutes, { prefix: '/api/v1/leads' });
    await app.register(conversationRoutes, { prefix: '/api/v1/conversations' });
    await app.register(messageRoutes, { prefix: '/api/v1/messages' });
    await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });
    await app.register(campaignRoutes, { prefix: '/api/v1/campaigns' });
    await app.register(voiceRoutes, { prefix: '/api/v1/voice' });
    await app.register(templateRoutes, { prefix: '/api/v1/templates' });
    await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
    await app.register(teamRoutes, { prefix: '/api/v1/team' });
    await app.register(taskRoutes, { prefix: '/api/v1/tasks' });
    await app.register(billingRoutes, { prefix: '/api/v1/billing' });
    await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
    await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
    await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
    await app.register(publicApiRoutes, { prefix: '/api/v1/public' });
    await app.register(healthRoutes, { prefix: '/health' });

    // Initialize background services
    const messageQueue = new MessageQueue(app);
    const workflowEngine = new WorkflowEngine(app);
    const antiBanService = new AntiBanService(app);
    const leadScoringService = new LeadScoringService(app);
    const analyticsService = new AnalyticsService(app);

    await messageQueue.initialize();
    await workflowEngine.initialize();
    await antiBanService.initialize();
    await leadScoringService.initialize();
    await analyticsService.initialize();

    // Decorate fastify instance with services
    app.decorate('messageQueue', messageQueue);
    app.decorate('workflowEngine', workflowEngine);
    app.decorate('antiBanService', antiBanService);
    app.decorate('leadScoringService', leadScoringService);
    app.decorate('analyticsService', analyticsService);

    // Start server
    const port = config.port;
    const host = config.host;

    await app.listen({ port, host });

    app.log.info(`🚀 BeeCastly API server running on http://${host}:${port}`);
    app.log.info(`📚 API Documentation available at http://${host}:${port}/docs`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Starting graceful shutdown...`);

      // Close background services
      await messageQueue.close();
      await workflowEngine.close();
      await antiBanService.close();
      await leadScoringService.close();
      await analyticsService.close();

      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

// Type declarations for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    messageQueue: MessageQueue;
    workflowEngine: WorkflowEngine;
    antiBanService: AntiBanService;
    leadScoringService: LeadScoringService;
    analyticsService: AnalyticsService;
  }
}
