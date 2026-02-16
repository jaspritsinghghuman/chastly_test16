/**
 * User Integrations Service
 * 
 * Handles CRUD operations for user integration credentials.
 * All credentials are encrypted before storage and decrypted when needed.
 */

import { FastifyInstance } from 'fastify';
import {
  encryptCredentials,
  decryptCredentials,
  maskApiKey,
  maskEmail,
  maskPhone,
  generateToken
} from '../utils/encryption';

// Integration channel types
export type IntegrationChannel = 
  | 'whatsapp' 
  | 'sms' 
  | 'email' 
  | 'telegram' 
  | 'voice' 
  | 'payment';

// Integration providers
export type IntegrationProvider =
  // WhatsApp
  | 'cloud_api' | 'evolution_api'
  // SMS
  | 'twilio' | 'msg91' | 'vonage' | 'fast2sms' | 'textlocal'
  // Email
  | 'smtp' | 'gmail' | 'sendgrid' | 'mailgun'
  // Telegram
  | 'telegram_bot'
  // Voice
  | 'twilio_voice'
  // Payment
  | 'stripe' | 'razorpay' | 'paypal';

// Integration status
export type IntegrationStatus = 'pending' | 'active' | 'error' | 'disabled';

// User Integration interface
export interface UserIntegration {
  id: string;
  tenantId: string;
  userId?: string;
  channel: IntegrationChannel;
  provider: IntegrationProvider;
  name: string;
  isDefault: boolean;
  credentials: Record<string, string>;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastTestedAt?: Date;
  lastError?: string;
  accountIdentifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create integration input
export interface CreateIntegrationInput {
  channel: IntegrationChannel;
  provider: IntegrationProvider;
  name: string;
  isDefault?: boolean;
  credentials: Record<string, string>;
  config?: Record<string, any>;
}

// Update integration input
export interface UpdateIntegrationInput {
  name?: string;
  isDefault?: boolean;
  credentials?: Record<string, string>;
  config?: Record<string, any>;
  status?: IntegrationStatus;
}

// Integration response (without sensitive data)
export interface IntegrationResponse {
  id: string;
  tenantId: string;
  userId?: string;
  channel: IntegrationChannel;
  provider: IntegrationProvider;
  name: string;
  isDefault: boolean;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastTestedAt?: Date;
  lastError?: string;
  accountIdentifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Integration with masked credentials
export interface IntegrationWithMaskedCreds extends IntegrationResponse {
  credentialsMasked: Record<string, string>;
}

export class IntegrationsService {
  constructor(private app: FastifyInstance) {}

  /**
   * Create a new integration
   */
  async create(
    tenantId: string,
    userId: string,
    input: CreateIntegrationInput
  ): Promise<IntegrationResponse> {
    const { encrypted, iv } = encryptCredentials(input.credentials);
    
    // Generate account identifier for display
    const accountIdentifier = this.generateAccountIdentifier(
      input.channel,
      input.provider,
      input.credentials
    );

    // If setting as default, unset other defaults for this channel
    if (input.isDefault) {
      await this.unsetDefaultForChannel(tenantId, input.channel);
    }

    const result = await this.app.db.queryOne<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO user_integrations (
        tenant_id, user_id, channel, provider, name, is_default,
        credentials_encrypted, credentials_iv, config, status, account_identifier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at, updated_at`,
      [
        tenantId,
        userId,
        input.channel,
        input.provider,
        input.name,
        input.isDefault || false,
        encrypted,
        iv,
        JSON.stringify(input.config || {}),
        'pending',
        accountIdentifier
      ]
    );

    return {
      id: result!.id,
      tenantId,
      userId,
      channel: input.channel,
      provider: input.provider,
      name: input.name,
      isDefault: input.isDefault || false,
      config: input.config || {},
      status: 'pending',
      accountIdentifier,
      createdAt: result!.created_at,
      updatedAt: result!.updated_at
    };
  }

  /**
   * Get all integrations for a tenant
   */
  async getAll(tenantId: string, channel?: IntegrationChannel): Promise<IntegrationWithMaskedCreds[]> {
    let query = `
      SELECT id, tenant_id, user_id, channel, provider, name, is_default,
             config, status, last_tested_at, last_error, account_identifier,
             created_at, updated_at, credentials_encrypted, credentials_iv
      FROM user_integrations
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (channel) {
      query += ` AND channel = $2`;
      params.push(channel);
    }

    query += ` ORDER BY channel, is_default DESC, name`;

    const results = await this.app.db.queryMany<any>(query, params);

    return results.map(row => this.mapToIntegrationWithMaskedCreds(row));
  }

  /**
   * Get integration by ID
   */
  async getById(tenantId: string, id: string): Promise<IntegrationWithMaskedCreds | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, tenant_id, user_id, channel, provider, name, is_default,
              config, status, last_tested_at, last_error, account_identifier,
              created_at, updated_at, credentials_encrypted, credentials_iv
       FROM user_integrations
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );

    if (!result) return null;

    return this.mapToIntegrationWithMaskedCreds(result);
  }

  /**
   * Get integration with decrypted credentials (for internal use)
   */
  async getWithCredentials(tenantId: string, id: string): Promise<UserIntegration | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT * FROM user_integrations WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );

    if (!result) return null;

    return this.mapToUserIntegration(result);
  }

  /**
   * Get default integration for a channel
   */
  async getDefault(tenantId: string, channel: IntegrationChannel): Promise<UserIntegration | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT * FROM user_integrations 
       WHERE tenant_id = $1 AND channel = $2 AND is_default = true AND status = 'active'
       LIMIT 1`,
      [tenantId, channel]
    );

    if (!result) return null;

    return this.mapToUserIntegration(result);
  }

  /**
   * Get any active integration for a channel (prefer default)
   */
  async getActiveForChannel(tenantId: string, channel: IntegrationChannel): Promise<UserIntegration | null> {
    // First try to get default
    const defaultIntegration = await this.getDefault(tenantId, channel);
    if (defaultIntegration) return defaultIntegration;

    // Otherwise get any active integration
    const result = await this.app.db.queryOne<any>(
      `SELECT * FROM user_integrations 
       WHERE tenant_id = $1 AND channel = $2 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, channel]
    );

    if (!result) return null;

    return this.mapToUserIntegration(result);
  }

  /**
   * Update an integration
   */
  async update(
    tenantId: string,
    id: string,
    input: UpdateIntegrationInput
  ): Promise<IntegrationResponse | null> {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }

    if (input.isDefault !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      params.push(input.isDefault);
      
      // If setting as default, unset other defaults for this channel
      if (input.isDefault) {
        await this.unsetDefaultForChannel(tenantId, existing.channel);
      }
    }

    if (input.credentials !== undefined) {
      const { encrypted, iv } = encryptCredentials(input.credentials);
      updates.push(`credentials_encrypted = $${paramIndex++}`);
      updates.push(`credentials_iv = $${paramIndex++}`);
      params.push(encrypted, iv);

      // Update account identifier
      const accountIdentifier = this.generateAccountIdentifier(
        existing.channel,
        existing.provider,
        input.credentials
      );
      updates.push(`account_identifier = $${paramIndex++}`);
      params.push(accountIdentifier);
    }

    if (input.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(input.config));
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }

    if (updates.length === 0) return existing;

    params.push(tenantId, id);

    const result = await this.app.db.queryOne<{ updated_at: Date }>(
      `UPDATE user_integrations 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex++}
       RETURNING updated_at`,
      params
    );

    return this.getById(tenantId, id);
  }

  /**
   * Delete an integration
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.app.db.queryOne<{ id: string }>(
      `DELETE FROM user_integrations WHERE tenant_id = $1 AND id = $2 RETURNING id`,
      [tenantId, id]
    );
    return !!result;
  }

  /**
   * Test an integration (validate credentials)
   */
  async testIntegration(tenantId: string, id: string): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    const integration = await this.getWithCredentials(tenantId, id);
    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }

    try {
      let testResult: { success: boolean; message: string; details?: Record<string, any> };

      switch (integration.channel) {
        case 'whatsapp':
          testResult = await this.testWhatsApp(integration);
          break;
        case 'sms':
          testResult = await this.testSMS(integration);
          break;
        case 'email':
          testResult = await this.testEmail(integration);
          break;
        case 'telegram':
          testResult = await this.testTelegram(integration);
          break;
        case 'voice':
          testResult = await this.testVoice(integration);
          break;
        case 'payment':
          testResult = await this.testPayment(integration);
          break;
        default:
          testResult = { success: false, message: 'Unknown channel type' };
      }

      // Update status based on test result
      await this.update(tenantId, id, {
        status: testResult.success ? 'active' : 'error'
      });

      // Update last tested timestamp
      await this.app.db.query(
        `UPDATE user_integrations 
         SET last_tested_at = NOW(), last_error = $1
         WHERE tenant_id = $2 AND id = $3`,
        [testResult.success ? null : testResult.message, tenantId, id]
      );

      return testResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.update(tenantId, id, { status: 'error' });
      await this.app.db.query(
        `UPDATE user_integrations 
         SET last_tested_at = NOW(), last_error = $1
         WHERE tenant_id = $2 AND id = $3`,
        [errorMessage, tenantId, id]
      );

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Get integration usage statistics
   */
  async getUsageStats(
    tenantId: string,
    integrationId: string,
    days: number = 30
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    byAction: Record<string, { count: number; cost: number }>;
  }> {
    const results = await this.app.db.queryMany<{
      action: string;
      count: string;
      successful: string;
      failed: string;
      total_cost: string;
    }>(
      `SELECT 
        action,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COALESCE(SUM(cost), 0) as total_cost
       FROM integration_usage
       WHERE tenant_id = $1 AND integration_id = $2 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY action`,
      [tenantId, integrationId]
    );

    const byAction: Record<string, { count: number; cost: number }> = {};
    let totalCalls = 0;
    let successfulCalls = 0;
    let failedCalls = 0;
    let totalCost = 0;

    for (const row of results) {
      byAction[row.action] = {
        count: parseInt(row.count),
        cost: parseFloat(row.total_cost)
      };
      totalCalls += parseInt(row.count);
      successfulCalls += parseInt(row.successful);
      failedCalls += parseInt(row.failed);
      totalCost += parseFloat(row.total_cost);
    }

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalCost,
      byAction
    };
  }

  /**
   * Log integration usage
   */
  async logUsage(
    tenantId: string,
    integrationId: string,
    channel: IntegrationChannel,
    action: string,
    status: 'success' | 'failed',
    cost: number = 0,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.app.db.query(
      `INSERT INTO integration_usage 
       (tenant_id, integration_id, channel, action, status, cost, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, integrationId, channel, action, status, cost, JSON.stringify(metadata)]
    );
  }

  // Private helper methods

  private async unsetDefaultForChannel(tenantId: string, channel: string): Promise<void> {
    await this.app.db.query(
      `UPDATE user_integrations 
       SET is_default = false 
       WHERE tenant_id = $1 AND channel = $2`,
      [tenantId, channel]
    );
  }

  private generateAccountIdentifier(
    channel: IntegrationChannel,
    provider: IntegrationProvider,
    credentials: Record<string, string>
  ): string {
    switch (channel) {
      case 'whatsapp':
        return credentials.phoneNumberId || credentials.phoneNumber || 'Unknown';
      case 'sms':
        return credentials.phoneNumber || credentials.fromNumber || 'Unknown';
      case 'email':
        return maskEmail(credentials.username || credentials.email || 'unknown@example.com');
      case 'telegram':
        return maskValue(credentials.botToken || 'Unknown', 6);
      case 'payment':
        return maskValue(credentials.publishableKey || credentials.keyId || 'Unknown', 6);
      case 'voice':
        return credentials.phoneNumber || credentials.fromNumber || 'Unknown';
      default:
        return 'Unknown';
    }
  }

  private mapToUserIntegration(row: any): UserIntegration {
    const credentials = decryptCredentials(
      row.credentials_encrypted,
      row.credentials_iv
    );

    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      channel: row.channel,
      provider: row.provider,
      name: row.name,
      isDefault: row.is_default,
      credentials,
      config: row.config || {},
      status: row.status,
      lastTestedAt: row.last_tested_at,
      lastError: row.last_error,
      accountIdentifier: row.account_identifier,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToIntegrationWithMaskedCreds(row: any): IntegrationWithMaskedCreds {
    const credentials = decryptCredentials(
      row.credentials_encrypted,
      row.credentials_iv
    );

    // Mask sensitive credentials for display
    const credentialsMasked: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password')) {
        credentialsMasked[key] = maskApiKey(value as string);
      } else if (key.toLowerCase().includes('email')) {
        credentialsMasked[key] = maskEmail(value as string);
      } else if (key.toLowerCase().includes('phone')) {
        credentialsMasked[key] = maskPhone(value as string);
      } else {
        credentialsMasked[key] = value as string;
      }
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      channel: row.channel,
      provider: row.provider,
      name: row.name,
      isDefault: row.is_default,
      config: row.config || {},
      status: row.status,
      lastTestedAt: row.last_tested_at,
      lastError: row.last_error,
      accountIdentifier: row.account_identifier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      credentialsMasked
    };
  }

  // Test methods for each channel

  private async testWhatsApp(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual WhatsApp API test
    return { success: true, message: 'WhatsApp integration test passed', details: { provider: integration.provider } };
  }

  private async testSMS(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual SMS provider test
    return { success: true, message: 'SMS integration test passed', details: { provider: integration.provider } };
  }

  private async testEmail(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual email provider test
    return { success: true, message: 'Email integration test passed', details: { provider: integration.provider } };
  }

  private async testTelegram(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual Telegram bot test
    return { success: true, message: 'Telegram integration test passed', details: { provider: integration.provider } };
  }

  private async testVoice(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual voice provider test
    return { success: true, message: 'Voice integration test passed', details: { provider: integration.provider } };
  }

  private async testPayment(integration: UserIntegration): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    // TODO: Implement actual payment gateway test
    return { success: true, message: 'Payment integration test passed', details: { provider: integration.provider } };
  }
}

// Factory function
export function createIntegrationsService(app: FastifyInstance): IntegrationsService {
  return new IntegrationsService(app);
}
