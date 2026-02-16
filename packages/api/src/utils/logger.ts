// ============================================
// BeeCastly Logger
// Pino-based structured logging
// ============================================

import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'beecastly-api',
    version: '1.0.0',
  },
});

// Child loggers for specific modules
export const createLogger = (module: string) =>
  logger.child({ module });

export const authLogger = createLogger('auth');
export const dbLogger = createLogger('database');
export const queueLogger = createLogger('queue');
export const aiLogger = createLogger('ai');
export const messageLogger = createLogger('message');
export const workflowLogger = createLogger('workflow');
export const voiceLogger = createLogger('voice');
export const webhookLogger = createLogger('webhook');
