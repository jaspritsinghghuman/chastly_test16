-- ============================================
-- BeeCastly Database Schema
-- PostgreSQL 15+ with partitioning support
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================
-- Core Tables
-- ============================================

-- Tenants (Multi-tenant support)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    status VARCHAR(20) DEFAULT 'active',
    whitelabel_enabled BOOLEAN DEFAULT FALSE,
    custom_domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    max_contacts INTEGER DEFAULT 1000,
    max_messages_per_day INTEGER DEFAULT 100,
    max_workflows INTEGER DEFAULT 5,
    max_team_members INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(500),
    role VARCHAR(50) DEFAULT 'agent',
    status VARCHAR(20) DEFAULT 'active',
    permissions JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp_number VARCHAR(50),
    telegram_username VARCHAR(100),
    company VARCHAR(255),
    job_title VARCHAR(100),
    source VARCHAR(50) DEFAULT 'manual',
    status VARCHAR(50) DEFAULT 'new',
    score_total INTEGER DEFAULT 0,
    ai_qualification_score INTEGER,
    ai_intent_detected VARCHAR(100),
    ai_sentiment VARCHAR(20),
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    assigned_to UUID REFERENCES users(id),
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Lead Capture Forms
CREATE TABLE IF NOT EXISTS lead_capture_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL DEFAULT '[]',
    ai_qualification_enabled BOOLEAN DEFAULT TRUE,
    auto_tag TEXT[] DEFAULT '{}',
    auto_assign UUID REFERENCES users(id),
    webhook_url VARCHAR(500),
    redirect_url VARCHAR(500),
    styling JSONB DEFAULT '{}',
    submissions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    channel_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    assigned_to UUID REFERENCES users(id),
    ai_enabled BOOLEAN DEFAULT TRUE,
    ai_context TEXT,
    metadata JSONB DEFAULT '{}',
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (Partitioned by created_at)
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    content TEXT,
    content_type VARCHAR(20) DEFAULT 'text',
    media_url VARCHAR(500),
    media_caption TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    fail_reason TEXT,
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_intent VARCHAR(100),
    ai_sentiment VARCHAR(20),
    ai_response TEXT,
    template_id UUID,
    campaign_id UUID,
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create message partitions
CREATE TABLE IF NOT EXISTS messages_y2024m01 PARTITION OF messages
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS messages_y2024m02 PARTITION OF messages
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS messages_y2024m03 PARTITION OF messages
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'utility',
    channel VARCHAR(20) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    header JSONB,
    buttons JSONB,
    footer TEXT,
    whatsapp_template_id VARCHAR(255),
    whatsapp_status VARCHAR(20),
    usage_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'broadcast',
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    template_id UUID REFERENCES message_templates(id),
    audience JSONB DEFAULT '{}',
    schedule JSONB,
    ab_test JSONB,
    stats JSONB DEFAULT '{}',
    sent_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    trigger JSONB NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    stats JSONB DEFAULT '{}',
    last_run_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id),
    status VARCHAR(20) DEFAULT 'running',
    context JSONB DEFAULT '{}',
    node_results JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT
);

-- Voice Calls
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id),
    conversation_id UUID REFERENCES conversations(id),
    campaign_id UUID REFERENCES campaigns(id),
    workflow_execution_id UUID REFERENCES workflow_executions(id),
    direction VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    from_number VARCHAR(50),
    to_number VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    recording_url VARCHAR(500),
    recording_duration INTEGER,
    transcript TEXT,
    ai_enabled BOOLEAN DEFAULT TRUE,
    ai_script TEXT,
    ai_summary TEXT,
    ai_sentiment VARCHAR(20),
    ai_outcome VARCHAR(100),
    cost DECIMAL(10, 4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Scripts
CREATE TABLE IF NOT EXISTS call_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    greeting TEXT,
    talking_points JSONB DEFAULT '[]',
    questions JSONB DEFAULT '[]',
    objections JSONB DEFAULT '{}',
    closing TEXT,
    ai_prompt TEXT,
    voice VARCHAR(20) DEFAULT 'alloy',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    conversation_id UUID REFERENCES conversations(id),
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100),
    assigned_channels JSONB DEFAULT '[]',
    max_concurrent_chats INTEGER DEFAULT 5,
    working_hours JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_preview VARCHAR(50),
    permissions JSONB DEFAULT '[]',
    allowed_ips JSONB,
    rate_limit INTEGER,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events JSONB NOT NULL,
    secret VARCHAR(255) NOT NULL,
    retry_config JSONB DEFAULT '{"maxRetries": 3, "retryDelay": 1000}',
    active BOOLEAN DEFAULT TRUE,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- Subscriptions & Plans
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) DEFAULT 'active',
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    payment_method JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'draft',
    items JSONB DEFAULT '[]',
    pdf_url VARCHAR(500),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota Usage
CREATE TABLE IF NOT EXISTS quota_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource VARCHAR(100) NOT NULL,
    limit_value INTEGER NOT NULL,
    used_value INTEGER DEFAULT 0,
    resets_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, resource)
);

-- Analytics Events (Partitioned)
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    user_id UUID,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Daily Stats
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    message_stats JSONB DEFAULT '{}',
    lead_stats JSONB DEFAULT '{}',
    campaign_stats JSONB DEFAULT '{}',
    workflow_stats JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, date)
);

-- Tenant Settings
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_settings JSONB DEFAULT '{}',
    ai_settings JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_tenant ON analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

-- ============================================
-- User Integrations (Stored in DB, NOT .env)
-- ============================================

-- User Integration Credentials (Encrypted)
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL, -- 'whatsapp', 'sms', 'email', 'telegram', 'voice', 'payment'
    provider VARCHAR(50) NOT NULL, -- 'twilio', 'msg91', 'smtp', 'gmail', 'stripe', etc.
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Encrypted credentials (AES-256 encrypted)
    credentials_encrypted TEXT NOT NULL,
    credentials_iv VARCHAR(255), -- Initialization vector for decryption
    
    -- Non-sensitive metadata (stored as JSONB)
    config JSONB DEFAULT '{}',
    
    -- Status and validation
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'error', 'disabled'
    last_tested_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Display purposes (masked)
    account_identifier VARCHAR(255), -- e.g., phone number, email, account ID (last 4 chars masked)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, channel, provider, name)
);

-- Integration Usage Log (for audit and billing)
CREATE TABLE IF NOT EXISTS integration_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'send_message', 'make_call', 'process_payment'
    status VARCHAR(20) DEFAULT 'success',
    cost DECIMAL(10, 6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Admin Platform Settings
-- ============================================

-- Admin Settings (Platform-level configuration)
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string', -- 'string', 'json', 'encrypted'
    category VARCHAR(50) NOT NULL, -- 'payment', 'email', 'sms', 'general', 'security'
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_editable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Payment Gateways (Admin configured)
CREATE TABLE IF NOT EXISTS platform_payment_gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL, -- 'stripe', 'razorpay', 'paypal'
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Encrypted credentials
    credentials_encrypted TEXT NOT NULL,
    credentials_iv VARCHAR(255),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    
    -- Webhook settings
    webhook_secret_encrypted TEXT,
    webhook_endpoint VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global Fallback Providers
CREATE TABLE IF NOT EXISTS global_fallback_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel VARCHAR(50) NOT NULL, -- 'sms', 'email'
    provider VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    credentials_encrypted TEXT NOT NULL,
    credentials_iv VARCHAR(255),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel, provider)
);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Encrypt sensitive data function (using pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION encrypt_value(
    p_value TEXT,
    p_key TEXT
) RETURNS TABLE(encrypted TEXT, iv TEXT) AS $$
DECLARE
    v_iv BYTEA;
    v_encrypted BYTEA;
BEGIN
    -- Generate random IV
    v_iv := gen_random_bytes(16);
    
    -- Encrypt using AES-256-CBC
    v_encrypted := encrypt(
        p_value::BYTEA,
        digest(p_key, 'sha256'),
        'aes-cbc/pad:pkcs',
        v_iv
    );
    
    RETURN QUERY SELECT encode(v_encrypted, 'base64'), encode(v_iv, 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_value(
    p_encrypted TEXT,
    p_iv TEXT,
    p_key TEXT
) RETURNS TEXT AS $$
DECLARE
    v_decrypted BYTEA;
BEGIN
    v_decrypted := decrypt(
        decode(p_encrypted, 'base64'),
        digest(p_key, 'sha256'),
        'aes-cbc/pad:pkcs',
        decode(p_iv, 'base64')
    );
    
    RETURN convert_from(v_decrypted, 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_integrations_updated_at BEFORE UPDATE ON user_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_payment_gateways_updated_at BEFORE UPDATE ON platform_payment_gateways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_fallback_providers_updated_at BEFORE UPDATE ON global_fallback_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Indexes for New Tables
-- ============================================

-- User integrations indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_tenant ON user_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_channel ON user_integrations(channel);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);

-- Integration usage indexes
CREATE INDEX IF NOT EXISTS idx_integration_usage_tenant ON integration_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_integration ON integration_usage(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_created ON integration_usage(created_at);

-- Admin settings indexes
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- ============================================
-- Seed Data
-- ============================================

-- Insert default plans
INSERT INTO plans (name, description, price, currency, features, limits) VALUES
('Free', 'Perfect for trying out BeeCastly', 0, 'USD', 
 '["WhatsApp messaging", "Email campaigns", "Basic templates", "Contact management", "Basic analytics"]'::jsonb,
 '{"maxContacts": 100, "maxMessagesPerDay": 50, "maxWorkflows": 2, "maxTeamMembers": 1}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO plans (name, description, price, currency, features, limits) VALUES
('Starter', 'For small businesses getting started', 29, 'USD',
 '["All Free features", "SMS messaging", "Telegram bot", "Basic workflows", "Lead scoring", "Team collaboration"]'::jsonb,
 '{"maxContacts": 1000, "maxMessagesPerDay": 500, "maxWorkflows": 10, "maxTeamMembers": 3}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO plans (name, description, price, currency, features, limits) VALUES
('Growth', 'For growing businesses', 99, 'USD',
 '["All Starter features", "AI lead qualification", "Voice calls", "Advanced workflows", "A/B testing", "API access", "Webhooks"]'::jsonb,
 '{"maxContacts": 10000, "maxMessagesPerDay": 5000, "maxWorkflows": 50, "maxTeamMembers": 10}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO plans (name, description, price, currency, features, limits) VALUES
('Enterprise', 'For large organizations', 299, 'USD',
 '["All Growth features", "White-label option", "Custom integrations", "Dedicated support", "SLA guarantee", "Advanced security"]'::jsonb,
 '{"maxContacts": 100000, "maxMessagesPerDay": 50000, "maxWorkflows": 500, "maxTeamMembers": 50}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Default Admin Settings
-- ============================================

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('platform.name', 'BeeCastly', 'string', 'general', 'Platform name displayed to users', false, true),
('platform.logo_url', '', 'string', 'general', 'URL to platform logo', false, true),
('platform.support_email', 'support@beecastly.com', 'string', 'general', 'Support email address', false, true),
('platform.terms_url', '/terms', 'string', 'general', 'Terms of service URL', false, true),
('platform.privacy_url', '/privacy', 'string', 'general', 'Privacy policy URL', false, true),
('platform.allow_signups', 'true', 'string', 'general', 'Allow new user registrations', false, true),
('platform.maintenance_mode', 'false', 'string', 'general', 'Enable maintenance mode', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('email.default_from_name', 'BeeCastly', 'string', 'email', 'Default sender name for emails', false, true),
('email.default_from_email', 'noreply@beecastly.com', 'string', 'email', 'Default sender email address', false, true),
('email.smtp_host', '', 'string', 'email', 'SMTP server hostname', false, true),
('email.smtp_port', '587', 'string', 'email', 'SMTP server port', false, true),
('email.smtp_secure', 'true', 'string', 'email', 'Use TLS for SMTP', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('sms.default_provider', '', 'string', 'sms', 'Default SMS provider for fallback', false, true),
('sms.fallback_enabled', 'true', 'string', 'sms', 'Enable SMS fallback provider', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('payment.currency_default', 'USD', 'string', 'payment', 'Default currency for payments', false, true),
('payment.tax_rate', '0', 'string', 'payment', 'Default tax rate percentage', false, true),
('payment.invoice_prefix', 'INV-', 'string', 'payment', 'Invoice number prefix', false, true),
('payment.trial_days', '14', 'string', 'payment', 'Free trial period in days', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('security.password_min_length', '8', 'string', 'security', 'Minimum password length', false, true),
('security.mfa_enabled', 'true', 'string', 'security', 'Enable multi-factor authentication option', false, true),
('security.session_timeout', '1440', 'string', 'security', 'Session timeout in minutes', false, true),
('security.max_login_attempts', '5', 'string', 'security', 'Maximum failed login attempts before lockout', false, true),
('security.lockout_duration', '30', 'string', 'security', 'Account lockout duration in minutes', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('ai.openai_model', 'gpt-4', 'string', 'ai', 'Default OpenAI model for AI features', false, true),
('ai.max_tokens', '2000', 'string', 'ai', 'Maximum tokens for AI responses', false, true),
('ai.temperature', '0.7', 'string', 'ai', 'AI temperature setting', false, true),
('ai.enable_lead_scoring', 'true', 'string', 'ai', 'Enable AI lead scoring', false, true),
('ai.enable_sentiment_analysis', 'true', 'string', 'ai', 'Enable AI sentiment analysis', false, true)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO admin_settings (setting_key, setting_value, value_type, category, description, is_encrypted, is_editable) VALUES
('quota.default_max_contacts', '1000', 'string', 'quota', 'Default max contacts for new tenants', false, true),
('quota.default_max_messages_per_day', '100', 'string', 'quota', 'Default max messages per day', false, true),
('quota.default_max_workflows', '5', 'string', 'quota', 'Default max workflows', false, true),
('quota.default_max_team_members', '3', 'string', 'quota', 'Default max team members', false, true)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- Create Default Tenant (for initial setup)
-- ============================================

INSERT INTO tenants (id, name, slug, plan, status, settings, max_contacts, max_messages_per_day, max_workflows, max_team_members)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'BeeCastly Admin',
    'admin',
    'enterprise',
    'active',
    '{"isAdminTenant": true}'::jsonb,
    1000000,
    1000000,
    1000,
    100
)
ON CONFLICT (id) DO NOTHING;

-- Create default admin user (password: admin123 - change in production!)
-- Password hash is for 'admin123' using bcrypt
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@beecastly.com',
    '$2b$10$YourHashHere.ChangeInProduction', -- CHANGE THIS!
    'System',
    'Administrator',
    'admin',
    'active'
)
ON CONFLICT (id) DO NOTHING;
