// ============================================
// Anti-Ban Service
// Reputation monitoring and rate limiting
// ============================================

import { FastifyInstance } from 'fastify';
import { queueLogger } from '../../utils/logger.js';

interface ReputationScore {
  tenantId: string;
  channel: string;
  score: number;
  messagesSent: number;
  messagesFailed: number;
  lastMessageAt: Date;
}

export class AntiBanService {
  private reputationScores: Map<string, ReputationScore> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private app: FastifyInstance) {}

  async initialize(): Promise<void> {
    // Start periodic reputation check
    this.checkInterval = setInterval(() => {
      this.checkReputation();
    }, 60000); // Check every minute

    queueLogger.info('Anti-ban service initialized');
  }

  async recordMessage(tenantId: string, channel: string, success: boolean): Promise<void> {
    const key = `${tenantId}:${channel}`;
    const existing = this.reputationScores.get(key);

    if (existing) {
      existing.messagesSent++;
      if (!success) {
        existing.messagesFailed++;
      }
      existing.lastMessageAt = new Date();
      // Adjust score
      existing.score = this.calculateScore(existing);
    } else {
      this.reputationScores.set(key, {
        tenantId,
        channel,
        score: success ? 100 : 90,
        messagesSent: 1,
        messagesFailed: success ? 0 : 1,
        lastMessageAt: new Date(),
      });
    }
  }

  private calculateScore(reputation: ReputationScore): number {
    const failureRate = reputation.messagesFailed / reputation.messagesSent;
    let score = 100 - failureRate * 50;

    // Penalize if messages are sent too quickly
    const now = new Date();
    const timeSinceLastMessage = now.getTime() - reputation.lastMessageAt.getTime();
    if (timeSinceLastMessage < 1000) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  async checkRateLimit(tenantId: string, channel: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = `${tenantId}:${channel}`;
    const reputation = this.reputationScores.get(key);

    if (!reputation) {
      return { allowed: true };
    }

    // Check if score is too low
    if (reputation.score < 30) {
      return { allowed: false, retryAfter: 3600 }; // Block for 1 hour
    }

    // Check message rate
    const messagesInLastHour = await this.app.db.queryOne(
      `SELECT COUNT(*) FROM messages 
       WHERE tenant_id = $1 AND channel = $2 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [tenantId, channel]
    );

    const hourlyLimit = 100; // Configurable per plan
    if (parseInt(messagesInLastHour?.count || '0') >= hourlyLimit) {
      return { allowed: false, retryAfter: 3600 };
    }

    return { allowed: true };
  }

  private async checkReputation(): Promise<void> {
    for (const [key, reputation] of this.reputationScores.entries()) {
      // Auto-pause campaigns if reputation drops too low
      if (reputation.score < 20) {
        queueLogger.warn({ tenantId: reputation.tenantId, channel: reputation.channel, score: reputation.score }, 'Low reputation detected, pausing campaigns');

        await this.app.db.query(
          "UPDATE campaigns SET status = 'paused' WHERE tenant_id = $1 AND channel = $2 AND status = 'running'",
          [reputation.tenantId, reputation.channel]
        );
      }
    }
  }

  getReputation(tenantId: string, channel: string): ReputationScore | undefined {
    return this.reputationScores.get(`${tenantId}:${channel}`);
  }

  async close(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    queueLogger.info('Anti-ban service closed');
  }
}
