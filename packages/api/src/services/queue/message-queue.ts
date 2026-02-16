// ============================================
// Message Queue Service
// BullMQ workers for message processing
// ============================================

import { Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';
import { queueLogger } from '../../utils/logger.js';

export class MessageQueue {
  private workers: Worker[] = [];

  constructor(private app: FastifyInstance) {}

  async initialize(): Promise<void> {
    // Message sending worker
    const messageWorker = new Worker(
      'messages',
      async (job: Job) => {
        const { messageId, tenantId, channel, content, mediaUrl, templateId, templateVariables } = job.data;

        queueLogger.debug({ messageId, channel }, 'Processing message');

        try {
          // Update message status
          await this.app.db.query(
            "UPDATE messages SET status = 'sending' WHERE id = $1",
            [messageId]
          );

          // Send based on channel
          let result;
          switch (channel) {
            case 'whatsapp':
              result = await this.sendWhatsApp(messageId, tenantId, content, mediaUrl, templateId, templateVariables);
              break;
            case 'sms':
              result = await this.sendSMS(messageId, tenantId, content);
              break;
            case 'email':
              result = await this.sendEmail(messageId, tenantId, content, templateId, templateVariables);
              break;
            case 'telegram':
              result = await this.sendTelegram(messageId, tenantId, content);
              break;
            default:
              throw new Error(`Unsupported channel: ${channel}`);
          }

          // Update message status
          await this.app.db.query(
            "UPDATE messages SET status = 'sent', sent_at = NOW() WHERE id = $1",
            [messageId]
          );

          // Broadcast status update
          this.app.broadcastToTenant(tenantId, 'message:status', {
            messageId,
            status: 'sent',
          });

          return result;
        } catch (error) {
          queueLogger.error({ error, messageId }, 'Failed to send message');

          // Update message status to failed
          await this.app.db.query(
            "UPDATE messages SET status = 'failed', fail_reason = $1 WHERE id = $2",
            [(error as Error).message, messageId]
          );

          throw error;
        }
      },
      { concurrency: config.queue.concurrency.messages }
    );

    messageWorker.on('completed', (job) => {
      queueLogger.debug({ jobId: job.id }, 'Message job completed');
    });

    messageWorker.on('failed', (job, error) => {
      queueLogger.error({ jobId: job?.id, error }, 'Message job failed');
    });

    this.workers.push(messageWorker);
    queueLogger.info('Message queue workers initialized');
  }

  private async sendWhatsApp(
    messageId: string,
    tenantId: string,
    content: string,
    mediaUrl?: string,
    templateId?: string,
    templateVariables?: Record<string, string>
  ): Promise<any> {
    // Implementation for WhatsApp Cloud API or Evolution API
    queueLogger.debug({ messageId }, 'Sending WhatsApp message');
    // TODO: Implement WhatsApp sending
    return { success: true };
  }

  private async sendSMS(messageId: string, tenantId: string, content: string): Promise<any> {
    // Implementation for SMS (Twilio, MSG91, etc.)
    queueLogger.debug({ messageId }, 'Sending SMS');
    // TODO: Implement SMS sending
    return { success: true };
  }

  private async sendEmail(
    messageId: string,
    tenantId: string,
    content: string,
    templateId?: string,
    templateVariables?: Record<string, string>
  ): Promise<any> {
    // Implementation for Email
    queueLogger.debug({ messageId }, 'Sending Email');
    // TODO: Implement Email sending
    return { success: true };
  }

  private async sendTelegram(messageId: string, tenantId: string, content: string): Promise<any> {
    // Implementation for Telegram Bot
    queueLogger.debug({ messageId }, 'Sending Telegram message');
    // TODO: Implement Telegram sending
    return { success: true };
  }

  async close(): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }
    queueLogger.info('Message queue workers closed');
  }
}
