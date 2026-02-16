// ============================================
// Settings Routes
// Tenant settings and User Integrations (DB-stored, NOT .env)
// ============================================

import { FastifyInstance } from 'fastify';
import { createIntegrationsService } from '../services/integrations.service';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get tenant settings
  fastify.get('/tenant', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const tenant = await fastify.db.queryOne(
      'SELECT id, name, slug, plan, settings, branding, whitelabel_enabled, custom_domain, max_contacts, max_messages_per_day, max_workflows, max_team_members FROM tenants WHERE id = $1',
      [tenantId]
    );

    return reply.send({ success: true, data: tenant });
  });

  // Update tenant settings
  fastify.patch('/tenant', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { name, settings, branding } = request.body as any;

    const updates: any = {};
    if (name) updates.name = name;
    if (settings) updates.settings = JSON.stringify(settings);
    if (branding) updates.branding = JSON.stringify(branding);

    const tenant = await fastify.db.update('tenants', tenantId, updates);

    return reply.send({ success: true, data: tenant });
  });

  // ============================================
  // User Integrations (Stored in DB, NOT .env)
  // ============================================

  const integrationsService = createIntegrationsService(fastify);

  // Get all integrations for tenant
  fastify.get('/integrations', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { channel } = request.query as { channel?: string };

    const integrations = await integrationsService.getAll(tenantId, channel as any);

    return reply.send({ success: true, data: integrations });
  });

  // Get integration by ID
  fastify.get('/integrations/:id', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { id } = request.params as { id: string };

    const integration = await integrationsService.getById(tenantId, id);

    if (!integration) {
      return reply.status(404).send({ success: false, error: 'Integration not found' });
    }

    return reply.send({ success: true, data: integration });
  });

  // Create new integration
  fastify.post('/integrations', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const userId = request.user.userId;
    const { channel, provider, name, isDefault, credentials, config } = request.body as any;

    // Validate required fields
    if (!channel || !provider || !name || !credentials) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: channel, provider, name, credentials'
      });
    }

    try {
      const integration = await integrationsService.create(tenantId, userId, {
        channel,
        provider,
        name,
        isDefault,
        credentials,
        config
      });

      return reply.status(201).send({ success: true, data: integration });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create integration'
      });
    }
  });

  // Update integration
  fastify.patch('/integrations/:id', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const integration = await integrationsService.update(tenantId, id, updates);

    if (!integration) {
      return reply.status(404).send({ success: false, error: 'Integration not found' });
    }

    return reply.send({ success: true, data: integration });
  });

  // Delete integration
  fastify.delete('/integrations/:id', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { id } = request.params as { id: string };

    const deleted = await integrationsService.delete(tenantId, id);

    if (!deleted) {
      return reply.status(404).send({ success: false, error: 'Integration not found' });
    }

    return reply.send({ success: true, data: { message: 'Integration deleted' } });
  });

  // Test integration
  fastify.post('/integrations/:id/test', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { id } = request.params as { id: string };

    const result = await integrationsService.testIntegration(tenantId, id);

    return reply.send({ success: result.success, data: result });
  });

  // Get integration usage stats
  fastify.get('/integrations/:id/stats', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { id } = request.params as { id: string };
    const { days = '30' } = request.query as { days?: string };

    const stats = await integrationsService.getUsageStats(
      tenantId,
      id,
      parseInt(days)
    );

    return reply.send({ success: true, data: stats });
  });

  // Get integration providers (public endpoint - no auth required)
  fastify.get('/integrations/providers', async (request, reply) => {
    const providers = {
      whatsapp: [
        { id: 'cloud_api', name: 'WhatsApp Cloud API', description: 'Official Meta WhatsApp Business API' },
        { id: 'evolution_api', name: 'Evolution API', description: 'Open-source WhatsApp API' }
      ],
      sms: [
        { id: 'twilio', name: 'Twilio', description: 'Global SMS provider' },
        { id: 'msg91', name: 'MSG91', description: 'Indian SMS provider' },
        { id: 'vonage', name: 'Vonage (Nexmo)', description: 'Global SMS and voice' },
        { id: 'fast2sms', name: 'Fast2SMS', description: 'Indian bulk SMS' },
        { id: 'textlocal', name: 'TextLocal', description: 'UK and global SMS' }
      ],
      email: [
        { id: 'smtp', name: 'SMTP', description: 'Custom SMTP server' },
        { id: 'gmail', name: 'Gmail OAuth', description: 'Send via Gmail' },
        { id: 'sendgrid', name: 'SendGrid', description: 'Email delivery platform' },
        { id: 'mailgun', name: 'Mailgun', description: 'Email API service' }
      ],
      telegram: [
        { id: 'telegram_bot', name: 'Telegram Bot', description: 'Official Telegram Bot API' }
      ],
      voice: [
        { id: 'twilio_voice', name: 'Twilio Voice', description: 'Voice calls via Twilio' }
      ],
      payment: [
        { id: 'stripe', name: 'Stripe', description: 'Online payment processing' },
        { id: 'razorpay', name: 'Razorpay', description: 'Indian payment gateway' },
        { id: 'paypal', name: 'PayPal', description: 'Global payment platform' }
      ]
    };

    return reply.send({ success: true, data: providers });
  });

  // Get provider credential fields
  fastify.get('/integrations/providers/:channel/:provider/fields', async (request, reply) => {
    const { channel, provider } = request.params as { channel: string; provider: string };

    const fields: Record<string, Array<{ name: string; type: string; label: string; required: boolean; description?: string }>> = {
      whatsapp: {
        cloud_api: [
          { name: 'accessToken', type: 'password', label: 'Access Token', required: true, description: 'WhatsApp Business API access token' },
          { name: 'phoneNumberId', type: 'text', label: 'Phone Number ID', required: true, description: 'WhatsApp phone number ID' },
          { name: 'businessAccountId', type: 'text', label: 'Business Account ID', required: true, description: 'WhatsApp Business Account ID' }
        ],
        evolution_api: [
          { name: 'apiUrl', type: 'text', label: 'API URL', required: true, description: 'Evolution API instance URL' },
          { name: 'apiKey', type: 'password', label: 'API Key', required: true, description: 'Evolution API key' },
          { name: 'instanceName', type: 'text', label: 'Instance Name', required: true, description: 'WhatsApp instance name' }
        ]
      },
      sms: {
        twilio: [
          { name: 'accountSid', type: 'text', label: 'Account SID', required: true },
          { name: 'authToken', type: 'password', label: 'Auth Token', required: true },
          { name: 'fromNumber', type: 'text', label: 'From Phone Number', required: true }
        ],
        msg91: [
          { name: 'authKey', type: 'password', label: 'Auth Key', required: true },
          { name: 'senderId', type: 'text', label: 'Sender ID', required: true },
          { name: 'route', type: 'text', label: 'Route', required: false }
        ],
        vonage: [
          { name: 'apiKey', type: 'text', label: 'API Key', required: true },
          { name: 'apiSecret', type: 'password', label: 'API Secret', required: true },
          { name: 'fromName', type: 'text', label: 'From Name', required: true }
        ]
      },
      email: {
        smtp: [
          { name: 'host', type: 'text', label: 'SMTP Host', required: true },
          { name: 'port', type: 'number', label: 'SMTP Port', required: true },
          { name: 'username', type: 'text', label: 'Username', required: true },
          { name: 'password', type: 'password', label: 'Password', required: true },
          { name: 'secure', type: 'boolean', label: 'Use TLS', required: false }
        ],
        gmail: [
          { name: 'clientId', type: 'text', label: 'Client ID', required: true },
          { name: 'clientSecret', type: 'password', label: 'Client Secret', required: true },
          { name: 'refreshToken', type: 'password', label: 'Refresh Token', required: true },
          { name: 'email', type: 'text', label: 'Gmail Address', required: true }
        ],
        sendgrid: [
          { name: 'apiKey', type: 'password', label: 'API Key', required: true },
          { name: 'fromEmail', type: 'text', label: 'From Email', required: true },
          { name: 'fromName', type: 'text', label: 'From Name', required: false }
        ]
      },
      telegram: {
        telegram_bot: [
          { name: 'botToken', type: 'password', label: 'Bot Token', required: true },
          { name: 'botUsername', type: 'text', label: 'Bot Username', required: false }
        ]
      },
      voice: {
        twilio_voice: [
          { name: 'accountSid', type: 'text', label: 'Account SID', required: true },
          { name: 'authToken', type: 'password', label: 'Auth Token', required: true },
          { name: 'fromNumber', type: 'text', label: 'From Phone Number', required: true },
          { name: 'twimlAppSid', type: 'text', label: 'TwiML App SID', required: false }
        ]
      },
      payment: {
        stripe: [
          { name: 'secretKey', type: 'password', label: 'Secret Key', required: true },
          { name: 'publishableKey', type: 'text', label: 'Publishable Key', required: true },
          { name: 'webhookSecret', type: 'password', label: 'Webhook Secret', required: false }
        ],
        razorpay: [
          { name: 'keyId', type: 'text', label: 'Key ID', required: true },
          { name: 'keySecret', type: 'password', label: 'Key Secret', required: true },
          { name: 'webhookSecret', type: 'password', label: 'Webhook Secret', required: false }
        ],
        paypal: [
          { name: 'clientId', type: 'text', label: 'Client ID', required: true },
          { name: 'clientSecret', type: 'password', label: 'Client Secret', required: true },
          { name: 'environment', type: 'select', label: 'Environment', required: true }
        ]
      }
    };

    const providerFields = fields[channel]?.[provider];

    if (!providerFields) {
      return reply.status(404).send({
        success: false,
        error: 'Provider not found for this channel'
      });
    }

    return reply.send({ success: true, data: providerFields });
  });

  // ============================================
  // Legacy Channel Settings (for backward compatibility)
  // ============================================

  // Get channel settings
  fastify.get('/channels', async (request, reply) => {
    const tenantId = request.user.tenantId;

    const settings = await fastify.db.queryOne(
      'SELECT channel_settings FROM tenant_settings WHERE tenant_id = $1',
      [tenantId]
    );

    return reply.send({
      success: true,
      data: settings?.channel_settings || {},
    });
  });

  // Update channel settings
  fastify.patch('/channels', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { whatsapp, sms, email, telegram, voice } = request.body as any;

    const existing = await fastify.db.queryOne(
      'SELECT id FROM tenant_settings WHERE tenant_id = $1',
      [tenantId]
    );

    const channelSettings: any = {};
    if (whatsapp) channelSettings.whatsapp = whatsapp;
    if (sms) channelSettings.sms = sms;
    if (email) channelSettings.email = email;
    if (telegram) channelSettings.telegram = telegram;
    if (voice) channelSettings.voice = voice;

    if (existing) {
      await fastify.db.query(
        `UPDATE tenant_settings 
         SET channel_settings = channel_settings || $1::jsonb,
         updated_at = NOW()
         WHERE tenant_id = $2`,
        [JSON.stringify(channelSettings), tenantId]
      );
    } else {
      await fastify.db.insert('tenant_settings', {
        tenant_id: tenantId,
        channel_settings: JSON.stringify(channelSettings),
      });
    }

    return reply.send({ success: true, data: { message: 'Settings updated' } });
  });

  // Test channel (uses active integration)
  fastify.post('/channels/test', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { channel, to, message = 'Test message from BeeCastly' } = request.body as any;

    // Get active integration for this channel
    const integration = await integrationsService.getActiveForChannel(tenantId, channel);

    if (!integration) {
      return reply.status(400).send({
        success: false,
        error: `No active ${channel} integration found. Please configure an integration first.`
      });
    }

    // Queue test message
    await fastify.addJob('messages', 'send-test', {
      tenantId,
      channel,
      integrationId: integration.id,
      to,
      message,
    });

    return reply.send({
      success: true,
      data: { message: 'Test message queued', integration: integration.name },
    });
  });
}
