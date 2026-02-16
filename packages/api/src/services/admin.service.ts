/**
 * Admin Settings Service
 * 
 * Handles platform-level configuration stored in the database.
 * Only accessible by users with admin role.
 */

import { FastifyInstance } from 'fastify';
import { encrypt, decrypt, encryptObject, decryptObject, maskApiKey } from '../utils/encryption';

// Admin setting interface
export interface AdminSetting {
  id: string;
  key: string;
  value: string;
  valueType: 'string' | 'json' | 'encrypted';
  category: string;
  description: string;
  isEncrypted: boolean;
  isEditable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Platform payment gateway interface
export interface PlatformPaymentGateway {
  id: string;
  provider: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  credentials: Record<string, string>;
  config: Record<string, any>;
  webhookEndpoint?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Global fallback provider interface
export interface GlobalFallbackProvider {
  id: string;
  channel: string;
  provider: string;
  priority: number;
  isActive: boolean;
  credentials: Record<string, string>;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Setting categories
export const SETTING_CATEGORIES = [
  'general',
  'email',
  'sms',
  'payment',
  'security',
  'ai',
  'quota'
] as const;

export type SettingCategory = typeof SETTING_CATEGORIES[number];

export class AdminService {
  constructor(private app: FastifyInstance) {}

  // ==================== Admin Settings ====================

  /**
   * Get all admin settings
   */
  async getAllSettings(category?: SettingCategory): Promise<AdminSetting[]> {
    let query = `
      SELECT id, setting_key, setting_value, value_type, category, 
             description, is_encrypted, is_editable, created_at, updated_at
      FROM admin_settings
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY category, setting_key`;

    const results = await this.app.db.queryMany<any>(query, params);

    return results.map(row => this.mapToAdminSetting(row));
  }

  /**
   * Get a single setting by key
   */
  async getSetting(key: string): Promise<AdminSetting | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, setting_key, setting_value, value_type, category, 
              description, is_encrypted, is_editable, created_at, updated_at
       FROM admin_settings
       WHERE setting_key = $1`,
      [key]
    );

    if (!result) return null;

    return this.mapToAdminSetting(result);
  }

  /**
   * Get setting value (decrypted if needed)
   */
  async getSettingValue<T = string>(key: string, defaultValue?: T): Promise<T | null> {
    const setting = await this.getSetting(key);
    if (!setting) return defaultValue ?? null;

    if (setting.valueType === 'json') {
      return JSON.parse(setting.value) as T;
    }

    return setting.value as unknown as T;
  }

  /**
   * Update a setting
   */
  async updateSetting(
    key: string,
    value: string,
    updatedBy: string
  ): Promise<AdminSetting | null> {
    const existing = await this.getSetting(key);
    if (!existing) return null;

    if (!existing.isEditable) {
      throw new Error('Setting is not editable');
    }

    // Encrypt if needed
    let storedValue = value;
    if (existing.isEncrypted) {
      const encrypted = encrypt(value);
      storedValue = JSON.stringify(encrypted);
    }

    const result = await this.app.db.queryOne<{ updated_at: Date }>(
      `UPDATE admin_settings 
       SET setting_value = $1, updated_at = NOW()
       WHERE setting_key = $2
       RETURNING updated_at`,
      [storedValue, key]
    );

    if (!result) return null;

    return this.getSetting(key);
  }

  /**
   * Create a new setting (admin only)
   */
  async createSetting(
    key: string,
    value: string,
    valueType: 'string' | 'json' | 'encrypted',
    category: SettingCategory,
    description: string,
    isEncrypted: boolean = false,
    isEditable: boolean = true
  ): Promise<AdminSetting> {
    // Check if setting already exists
    const existing = await this.getSetting(key);
    if (existing) {
      throw new Error(`Setting with key '${key}' already exists`);
    }

    let storedValue = value;
    if (isEncrypted) {
      const encrypted = encrypt(value);
      storedValue = JSON.stringify(encrypted);
    }

    const result = await this.app.db.queryOne<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, updated_at`,
      [key, storedValue, valueType, category, description, isEncrypted, isEditable]
    );

    return {
      id: result!.id,
      key,
      value,
      valueType,
      category,
      description,
      isEncrypted,
      isEditable,
      createdAt: result!.created_at,
      updatedAt: result!.updated_at
    };
  }

  /**
   * Delete a setting (admin only)
   */
  async deleteSetting(key: string): Promise<boolean> {
    const result = await this.app.db.queryOne<{ id: string }>(
      `DELETE FROM admin_settings WHERE setting_key = $1 RETURNING id`,
      [key]
    );
    return !!result;
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(category: SettingCategory): Promise<Record<string, any>> {
    const settings = await this.getAllSettings(category);
    const result: Record<string, any> = {};

    for (const setting of settings) {
      const keyParts = setting.key.split('.');
      const lastKey = keyParts[keyParts.length - 1];

      if (setting.valueType === 'json') {
        result[lastKey] = JSON.parse(setting.value);
      } else {
        result[lastKey] = setting.value;
      }
    }

    return result;
  }

  // ==================== Platform Payment Gateways ====================

  /**
   * Get all payment gateways
   */
  async getPaymentGateways(): Promise<PlatformPaymentGateway[]> {
    const results = await this.app.db.queryMany<any>(
      `SELECT id, provider, name, is_default, is_active, config, 
              webhook_endpoint, created_at, updated_at,
              credentials_encrypted, credentials_iv
       FROM platform_payment_gateways
       ORDER BY provider, name`
    );

    return results.map(row => this.mapToPaymentGateway(row));
  }

  /**
   * Get default payment gateway
   */
  async getDefaultPaymentGateway(): Promise<PlatformPaymentGateway | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, provider, name, is_default, is_active, config, 
              webhook_endpoint, created_at, updated_at,
              credentials_encrypted, credentials_iv
       FROM platform_payment_gateways
       WHERE is_default = true AND is_active = true
       LIMIT 1`
    );

    if (!result) return null;

    return this.mapToPaymentGateway(result);
  }

  /**
   * Get payment gateway by provider
   */
  async getPaymentGatewayByProvider(provider: string): Promise<PlatformPaymentGateway | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, provider, name, is_default, is_active, config, 
              webhook_endpoint, created_at, updated_at,
              credentials_encrypted, credentials_iv
       FROM platform_payment_gateways
       WHERE provider = $1 AND is_active = true
       LIMIT 1`,
      [provider]
    );

    if (!result) return null;

    return this.mapToPaymentGateway(result);
  }

  /**
   * Create payment gateway
   */
  async createPaymentGateway(
    provider: string,
    name: string,
    credentials: Record<string, string>,
    config: Record<string, any> = {},
    isDefault: boolean = false,
    webhookEndpoint?: string
  ): Promise<PlatformPaymentGateway> {
    const { encrypted, iv } = encryptObject(credentials);

    // If setting as default, unset other defaults
    if (isDefault) {
      await this.app.db.query(
        `UPDATE platform_payment_gateways SET is_default = false`
      );
    }

    const result = await this.app.db.queryOne<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO platform_payment_gateways 
       (provider, name, is_default, credentials_encrypted, credentials_iv, config, webhook_endpoint)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, updated_at`,
      [provider, name, isDefault, encrypted, iv, JSON.stringify(config), webhookEndpoint]
    );

    return {
      id: result!.id,
      provider,
      name,
      isDefault,
      isActive: true,
      credentials,
      config,
      webhookEndpoint,
      createdAt: result!.created_at,
      updatedAt: result!.updated_at
    };
  }

  /**
   * Update payment gateway
   */
  async updatePaymentGateway(
    id: string,
    updates: {
      name?: string;
      credentials?: Record<string, string>;
      config?: Record<string, any>;
      isDefault?: boolean;
      isActive?: boolean;
      webhookEndpoint?: string;
    }
  ): Promise<PlatformPaymentGateway | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.credentials !== undefined) {
      const { encrypted, iv } = encryptObject(updates.credentials);
      sets.push(`credentials_encrypted = $${paramIndex++}`);
      sets.push(`credentials_iv = $${paramIndex++}`);
      params.push(encrypted, iv);
    }

    if (updates.config !== undefined) {
      sets.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(updates.config));
    }

    if (updates.isDefault !== undefined) {
      sets.push(`is_default = $${paramIndex++}`);
      params.push(updates.isDefault);
      
      if (updates.isDefault) {
        await this.app.db.query(
          `UPDATE platform_payment_gateways SET is_default = false`
        );
      }
    }

    if (updates.isActive !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (updates.webhookEndpoint !== undefined) {
      sets.push(`webhook_endpoint = $${paramIndex++}`);
      params.push(updates.webhookEndpoint);
    }

    if (sets.length === 0) {
      return this.getPaymentGatewayById(id);
    }

    params.push(id);

    await this.app.db.query(
      `UPDATE platform_payment_gateways 
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++}`,
      params
    );

    return this.getPaymentGatewayById(id);
  }

  /**
   * Get payment gateway by ID
   */
  async getPaymentGatewayById(id: string): Promise<PlatformPaymentGateway | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, provider, name, is_default, is_active, config, 
              webhook_endpoint, created_at, updated_at,
              credentials_encrypted, credentials_iv
       FROM platform_payment_gateways
       WHERE id = $1`,
      [id]
    );

    if (!result) return null;

    return this.mapToPaymentGateway(result);
  }

  /**
   * Delete payment gateway
   */
  async deletePaymentGateway(id: string): Promise<boolean> {
    const result = await this.app.db.queryOne<{ id: string }>(
      `DELETE FROM platform_payment_gateways WHERE id = $1 RETURNING id`,
      [id]
    );
    return !!result;
  }

  // ==================== Global Fallback Providers ====================

  /**
   * Get all fallback providers
   */
  async getFallbackProviders(channel?: string): Promise<GlobalFallbackProvider[]> {
    let query = `
      SELECT id, channel, provider, priority, is_active, config, 
             created_at, updated_at, credentials_encrypted, credentials_iv
      FROM global_fallback_providers
      WHERE 1=1
    `;
    const params: any[] = [];

    if (channel) {
      query += ` AND channel = $1`;
      params.push(channel);
    }

    query += ` ORDER BY channel, priority`;

    const results = await this.app.db.queryMany<any>(query, params);

    return results.map(row => this.mapToFallbackProvider(row));
  }

  /**
   * Create fallback provider
   */
  async createFallbackProvider(
    channel: string,
    provider: string,
    credentials: Record<string, string>,
    priority: number = 1,
    config: Record<string, any> = {}
  ): Promise<GlobalFallbackProvider> {
    const { encrypted, iv } = encryptObject(credentials);

    const result = await this.app.db.queryOne<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO global_fallback_providers 
       (channel, provider, priority, credentials_encrypted, credentials_iv, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at, updated_at`,
      [channel, provider, priority, encrypted, iv, JSON.stringify(config)]
    );

    return {
      id: result!.id,
      channel,
      provider,
      priority,
      isActive: true,
      credentials,
      config,
      createdAt: result!.created_at,
      updatedAt: result!.updated_at
    };
  }

  /**
   * Update fallback provider
   */
  async updateFallbackProvider(
    id: string,
    updates: {
      priority?: number;
      credentials?: Record<string, string>;
      config?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<GlobalFallbackProvider | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.priority !== undefined) {
      sets.push(`priority = $${paramIndex++}`);
      params.push(updates.priority);
    }

    if (updates.credentials !== undefined) {
      const { encrypted, iv } = encryptObject(updates.credentials);
      sets.push(`credentials_encrypted = $${paramIndex++}`);
      sets.push(`credentials_iv = $${paramIndex++}`);
      params.push(encrypted, iv);
    }

    if (updates.config !== undefined) {
      sets.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(updates.config));
    }

    if (updates.isActive !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (sets.length === 0) {
      return this.getFallbackProviderById(id);
    }

    params.push(id);

    await this.app.db.query(
      `UPDATE global_fallback_providers 
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++}`,
      params
    );

    return this.getFallbackProviderById(id);
  }

  /**
   * Get fallback provider by ID
   */
  async getFallbackProviderById(id: string): Promise<GlobalFallbackProvider | null> {
    const result = await this.app.db.queryOne<any>(
      `SELECT id, channel, provider, priority, is_active, config, 
              created_at, updated_at, credentials_encrypted, credentials_iv
       FROM global_fallback_providers
       WHERE id = $1`,
      [id]
    );

    if (!result) return null;

    return this.mapToFallbackProvider(result);
  }

  /**
   * Delete fallback provider
   */
  async deleteFallbackProvider(id: string): Promise<boolean> {
    const result = await this.app.db.queryOne<{ id: string }>(
      `DELETE FROM global_fallback_providers WHERE id = $1 RETURNING id`,
      [id]
    );
    return !!result;
  }

  // ==================== System Status ====================

  /**
   * Get system status overview
   */
  async getSystemStatus(): Promise<{
    tenants: { total: number; active: number };
    users: { total: number; active: number };
    messages: { total: number; last24h: number };
    integrations: { total: number; active: number };
    queues: { pending: number; processing: number; failed: number };
  }> {
    const [tenantStats, userStats, messageStats, integrationStats] = await Promise.all([
      this.app.db.queryOne<{ total: string; active: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
         FROM tenants`
      ),
      this.app.db.queryOne<{ total: string; active: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
         FROM users`
      ),
      this.app.db.queryOne<{ total: string; last24h: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last24h
         FROM messages`
      ),
      this.app.db.queryOne<{ total: string; active: string }>(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
         FROM user_integrations`
      )
    ]);

    return {
      tenants: {
        total: parseInt(tenantStats?.total || '0'),
        active: parseInt(tenantStats?.active || '0')
      },
      users: {
        total: parseInt(userStats?.total || '0'),
        active: parseInt(userStats?.active || '0')
      },
      messages: {
        total: parseInt(messageStats?.total || '0'),
        last24h: parseInt(messageStats?.last24h || '0')
      },
      integrations: {
        total: parseInt(integrationStats?.total || '0'),
        active: parseInt(integrationStats?.active || '0')
      },
      queues: {
        pending: 0, // TODO: Get from BullMQ
        processing: 0,
        failed: 0
      }
    };
  }

  // Private helper methods

  private mapToAdminSetting(row: any): AdminSetting {
    let value = row.setting_value;

    // Decrypt if needed
    if (row.is_encrypted && value) {
      try {
        const parsed = JSON.parse(value);
        value = decrypt(parsed.encrypted, parsed.iv);
      } catch {
        // If parsing fails, return as-is
      }
    }

    return {
      id: row.id,
      key: row.setting_key,
      value,
      valueType: row.value_type,
      category: row.category,
      description: row.description,
      isEncrypted: row.is_encrypted,
      isEditable: row.is_editable,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToPaymentGateway(row: any): PlatformPaymentGateway {
    const credentials = decryptObject(
      row.credentials_encrypted,
      row.credentials_iv
    );

    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      isDefault: row.is_default,
      isActive: row.is_active,
      credentials,
      config: row.config || {},
      webhookEndpoint: row.webhook_endpoint,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToFallbackProvider(row: any): GlobalFallbackProvider {
    const credentials = decryptObject(
      row.credentials_encrypted,
      row.credentials_iv
    );

    return {
      id: row.id,
      channel: row.channel,
      provider: row.provider,
      priority: row.priority,
      isActive: row.is_active,
      credentials,
      config: row.config || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Factory function
export function createAdminService(app: FastifyInstance): AdminService {
  return new AdminService(app);
}
