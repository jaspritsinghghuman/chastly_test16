// ============================================
// Lead Scoring Service
// AI-powered lead qualification and scoring
// ============================================

import { Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { queueLogger } from '../../utils/logger.js';

export class LeadScoringService {
  private worker: Worker | null = null;

  constructor(private app: FastifyInstance) {}

  async initialize(): Promise<void> {
    this.worker = new Worker(
      'ai',
      async (job: Job) => {
        const { name, data } = job;

        switch (name) {
          case 'qualify-lead':
            return this.qualifyLead(data);
          case 'score-lead':
            return this.scoreLead(data);
          case 'revive-leads':
            return this.reviveLeads(data);
          default:
            throw new Error(`Unknown AI job: ${name}`);
        }
      },
      { concurrency: 5 }
    );

    this.worker.on('completed', (job) => {
      queueLogger.debug({ jobId: job.id, name: job.name }, 'AI job completed');
    });

    this.worker.on('failed', (job, error) => {
      queueLogger.error({ jobId: job?.id, error }, 'AI job failed');
    });

    queueLogger.info('Lead scoring service initialized');
  }

  private async qualifyLead(data: any): Promise<any> {
    const { leadId, tenantId, leadData } = data;

    try {
      // Use AI to qualify lead
      const qualification = await this.app.ai.qualifyLead(leadData);

      // Update lead with qualification
      await this.app.db.query(
        `UPDATE leads SET 
          ai_qualification_score = $1,
          ai_intent_detected = $2,
          ai_sentiment = $3,
          score_total = score_total + $1
        WHERE id = $4`,
        [qualification.score, qualification.intent, qualification.sentiment, leadId]
      );

      // If high score, trigger workflow
      if (qualification.score >= 70) {
        await this.triggerHighScoreWorkflow(tenantId, leadId);
      }

      return qualification;
    } catch (error) {
      queueLogger.error({ error, leadId }, 'Lead qualification failed');
      throw error;
    }
  }

  private async scoreLead(data: any): Promise<any> {
    const { leadId, tenantId } = data;

    // Get lead activity
    const activity = await this.app.db.queryOne(
      `SELECT 
        (SELECT COUNT(*) FROM messages WHERE lead_id = $1) as message_count,
        (SELECT COUNT(*) FROM conversations WHERE lead_id = $1) as conversation_count,
        (SELECT MAX(created_at) FROM messages WHERE lead_id = $1) as last_activity`,
      [leadId]
    );

    // Calculate scores
    const behaviorScore = Math.min(40, (activity?.message_count || 0) * 5);
    const engagementScore = activity?.last_activity
      ? Math.min(35, Math.floor((Date.now() - new Date(activity.last_activity).getTime()) / (1000 * 60 * 60 * 24)) * 5)
      : 0;
    const demographicScore = 25; // Base score

    const totalScore = behaviorScore + engagementScore + demographicScore;

    // Update lead score
    await this.app.db.query(
      'UPDATE leads SET score_total = $1 WHERE id = $2 AND tenant_id = $3',
      [totalScore, leadId, tenantId]
    );

    return {
      leadId,
      total: totalScore,
      behavior: behaviorScore,
      engagement: engagementScore,
      demographic: demographicScore,
    };
  }

  private async reviveLeads(data: any): Promise<any> {
    const { tenantId } = data;

    // Find dormant leads
    const dormantLeads = await this.app.db.queryMany(
      `SELECT id FROM leads 
       WHERE tenant_id = $1 
       AND status = 'dormant'
       AND last_activity_at < NOW() - INTERVAL '30 days'`,
      [tenantId]
    );

    for (const lead of dormantLeads) {
      // Trigger revival workflow
      await this.app.addJob('workflows', 'trigger-revival', {
        tenantId,
        leadId: lead.id,
      });
    }

    return { revived: dormantLeads.length };
  }

  private async triggerHighScoreWorkflow(tenantId: string, leadId: string): Promise<void> {
    // Find active workflows triggered by high score
    const workflows = await this.app.db.queryMany(
      `SELECT id FROM workflows 
       WHERE tenant_id = $1 
       AND status = 'active'
       AND trigger->>'type' = 'lead_scored_high'`,
      [tenantId]
    );

    for (const workflow of workflows) {
      await this.app.workflowEngine.execute(workflow.id, {
        tenantId,
        leadId,
      });
    }
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    queueLogger.info('Lead scoring service closed');
  }
}
