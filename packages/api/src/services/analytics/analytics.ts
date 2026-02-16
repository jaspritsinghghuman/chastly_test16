// ============================================
// Analytics Service
// Event tracking and metrics aggregation
// ============================================

import { Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { queueLogger } from '../../utils/logger.js';

export class AnalyticsService {
  private worker: Worker | null = null;
  private aggregationInterval: NodeJS.Timeout | null = null;

  constructor(private app: FastifyInstance) {}

  async initialize(): Promise<void> {
    // Analytics processing worker
    this.worker = new Worker(
      'analytics',
      async (job: Job) => {
        const { name, data } = job;

        switch (name) {
          case 'track-event':
            return this.trackEvent(data);
          case 'aggregate-stats':
            return this.aggregateStats(data);
          default:
            throw new Error(`Unknown analytics job: ${name}`);
        }
      },
      { concurrency: 20 }
    );

    // Start periodic aggregation
    this.aggregationInterval = setInterval(() => {
      this.runAggregation();
    }, 3600000); // Aggregate every hour

    queueLogger.info('Analytics service initialized');
  }

  private async trackEvent(data: any): Promise<void> {
    const { tenantId, eventType, entityType, entityId, metadata, userId, sessionId } = data;

    await this.app.db.insert('analytics_events', {
      tenant_id: tenantId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata: JSON.stringify(metadata || {}),
      user_id: userId,
      session_id: sessionId,
    });
  }

  private async aggregateStats(data: any): Promise<void> {
    const { tenantId, date } = data;

    // Aggregate message stats
    const messageStats = await this.app.db.queryOne(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        channel
      FROM messages
      WHERE tenant_id = $1 AND DATE(created_at) = $2
      GROUP BY channel`,
      [tenantId, date]
    );

    // Aggregate lead stats
    const leadStats = await this.app.db.queryOne(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 day') THEN 1 END) as new
      FROM leads
      WHERE tenant_id = $1`,
      [tenantId, date]
    );

    // Store daily stats
    await this.app.db.query(
      `INSERT INTO daily_stats (tenant_id, date, message_stats, lead_stats)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, date)
       DO UPDATE SET
         message_stats = EXCLUDED.message_stats,
         lead_stats = EXCLUDED.lead_stats,
         updated_at = NOW()`,
      [
        tenantId,
        date,
        JSON.stringify(messageStats),
        JSON.stringify(leadStats),
      ]
    );
  }

  private async runAggregation(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Get all tenants
    const tenants = await this.app.db.queryMany('SELECT id FROM tenants WHERE status = $1', ['active']);

    for (const tenant of tenants) {
      await this.app.addJob('analytics', 'aggregate-stats', {
        tenantId: tenant.id,
        date: dateStr,
      });
    }

    queueLogger.debug('Aggregation jobs queued for all tenants');
  }

  async track(
    tenantId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    metadata?: any,
    userId?: string
  ): Promise<void> {
    await this.app.addJob('analytics', 'track-event', {
      tenantId,
      eventType,
      entityType,
      entityId,
      metadata,
      userId,
    });
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    queueLogger.info('Analytics service closed');
  }
}
