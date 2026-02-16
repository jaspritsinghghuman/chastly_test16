-- BeeCastly Database Schema
-- Multi-tenant SaaS for AI-powered omnichannel sales & marketing automation
-- PostgreSQL 15+ with partitioning support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- TENANT & USER MANAGEMENT
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'enterprise', 'agency')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    
    -- White-label settings (for agency mode)
    whitelabel_enabled BOOLEAN DEFAULT FALSE,
    custom_domain VARCHAR(255),
    brand_logo_url TEXT,
    brand_primary_color VARCHAR(7) DEFAULT '#3B82F6',
    brand_name VARCHAR(255),
    
    -- Billing
    billing_email VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    billing_cycle_start DATE,
    billing_cycle_end DATE,
    
    -- Quota limits (enforced by plan)
    max_contacts INTEGER DEFAULT 1000,
    max_messages_per_day INTEGER DEFAULT 100,
    max_workflows INTEGER DEFAULT 5,
    max_team_members INTEGER DEFAULT 1,
    max_api_calls_per_day INTEGER DEFAULT 1000,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_plan ON tenants(plan);

-- Users table (multi-tenant)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(50),
    
    -- Role & permissions
    role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('super_admin', 'admin', 'manager', 'agent', 'viewer')),
    permissions JSONB DEFAULT '[]', -- Custom permissions array
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    
    -- 2FA
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    
    -- Notifications
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- API Keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- Hashed key
    key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for display
    
    -- Permissions
    permissions JSONB DEFAULT '["messages:send", "contacts:read"]',
    allowed_ips INET[], -- IP whitelist
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- Usage tracking
    usage_count_total INTEGER DEFAULT 0,
    usage_count_today INTEGER DEFAULT 0,
    usage_reset_at DATE DEFAULT CURRENT_DATE,
    last_used_at TIMESTAMPTZ,
    
    -- Expiry
    expires_at TIMESTAMPTZ,
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(tenant_id, key_prefix)
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- ============================================
-- LEAD CAPTURE & AI QUALIFICATION
-- ============================================

CREATE TABLE lead_capture_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    
    -- Form configuration
    form_config JSONB NOT NULL DEFAULT '{
        "fields": [
            {"name": "name", "type": "text", "required": true},
            {"name": "email", "type": "email", "required": true},
            {"name": "phone", "type": "tel", "required": false}
        ],
        "styling": {"backgroundColor": "#ffffff", "buttonColor": "#3B82F6"}
    }',
    
    -- AI settings
    ai_enabled BOOLEAN DEFAULT TRUE,
    ai_qualification_prompt TEXT,
    ai_min_score INTEGER DEFAULT 50, -- Minimum score to qualify as lead
    
    -- Behavior tracking
    track_page_views BOOLEAN DEFAULT TRUE,
    track_time_on_page BOOLEAN DEFAULT TRUE,
    track_scroll_depth BOOLEAN DEFAULT TRUE,
    
    -- Exit intent
    exit_intent_enabled BOOLEAN DEFAULT TRUE,
    exit_intent_delay_seconds INTEGER DEFAULT 5,
    exit_intent_message TEXT DEFAULT 'Wait! Before you go...',
    
    -- Auto-actions
    auto_call_enabled BOOLEAN DEFAULT FALSE,
    auto_call_delay_seconds INTEGER DEFAULT 60,
    auto_add_to_workflow UUID REFERENCES workflows(id),
    
    -- Embedding
    embed_code TEXT,
    allowed_domains TEXT[], -- CORS whitelist
    
    -- Stats
    views_count INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_lead_forms_tenant ON lead_capture_forms(tenant_id);
CREATE INDEX idx_lead_forms_status ON lead_capture_forms(status);

-- Leads table with AI qualification
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source tracking
    source VARCHAR(50) NOT NULL, -- 'form', 'api', 'import', 'voice_call', 'webhook'
    source_id UUID, -- Reference to form, campaign, etc.
    source_details JSONB, -- UTM params, referrer, etc.
    
    -- Contact info
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    country_code VARCHAR(5),
    
    -- Validation
    email_validated BOOLEAN DEFAULT FALSE,
    email_validation_error TEXT,
    phone_validated BOOLEAN DEFAULT FALSE,
    phone_validation_error TEXT,
    
    -- AI Qualification
    ai_qualification_score INTEGER, -- 0-100
    ai_qualification_reason TEXT,
    ai_intent_detected VARCHAR(50), -- 'pricing', 'demo', 'buy', 'support', etc.
    ai_qualified_at TIMESTAMPTZ,
    
    -- Behavior tracking
    page_views JSONB DEFAULT '[]', -- Array of {url, timeSpent, scrollDepth}
    referrer_url TEXT,
    landing_page TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Lead scoring
    score_total INTEGER DEFAULT 0, -- 0-100
    score_breakdown JSONB DEFAULT '{}', -- {behavior: 30, engagement: 20, demographics: 10}
    lead_temperature VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN score_total >= 70 THEN 'hot'
            WHEN score_total >= 40 THEN 'warm'
            ELSE 'cold'
        END
    ) STORED,
    
    -- Status
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'nurturing', 'converted', 'lost', 'unsubscribed')),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    
    -- Conversion
    converted_at TIMESTAMPTZ,
    conversion_value DECIMAL(12,2),
    
    -- GDPR
    gdpr_consent BOOLEAN DEFAULT FALSE,
    gdpr_consent_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribed_reason TEXT,
    
    -- Custom fields
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Full-text search
    search_vector TSVECTOR
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_temperature ON leads(lead_temperature);
CREATE INDEX idx_leads_score ON leads(score_total DESC);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_tags ON leads USING GIN(tags);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_search ON leads USING GIN(search_vector);

-- Trigger for full-text search
CREATE OR REPLACE FUNCTION update_lead_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.phone, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_search
    BEFORE INSERT OR UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_search_vector();

-- Lead activity log
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    activity_type VARCHAR(50) NOT NULL, -- 'page_view', 'form_submit', 'email_open', 'link_click', 'call', 'reply'
    activity_data JSONB,
    
    -- AI analysis
    ai_analyzed BOOLEAN DEFAULT FALSE,
    ai_intent VARCHAR(50),
    ai_sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_type ON lead_activities(activity_type);
CREATE INDEX idx_lead_activities_created ON lead_activities(created_at DESC);

-- ============================================
-- AI VOICE CALLING
-- ============================================

CREATE TABLE voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id),
    
    -- Call details
    call_sid VARCHAR(255), -- Twilio call SID
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    
    -- AI bot configuration
    ai_bot_enabled BOOLEAN DEFAULT TRUE,
    ai_bot_script JSONB, -- Conversation flow
    ai_voice_id VARCHAR(50) DEFAULT 'alloy', -- OpenAI voice
    
    -- Call status
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail')),
    
    -- Timing
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Recording & transcription
    recording_url TEXT,
    transcription TEXT,
    transcription_confidence DECIMAL(4,3),
    
    -- AI analysis
    ai_summary TEXT,
    ai_key_points JSONB,
    ai_intent_detected VARCHAR(50),
    ai_lead_qualified BOOLEAN,
    ai_qualification_score INTEGER,
    ai_next_action_recommended VARCHAR(50),
    
    -- Outcome
    outcome VARCHAR(50), -- 'qualified', 'not_interested', 'callback_requested', 'voicemail', 'wrong_number'
    callback_scheduled_at TIMESTAMPTZ,
    
    -- Cost tracking
    cost DECIMAL(10,4),
    currency VARCHAR(3) DEFAULT 'USD',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_calls_tenant ON voice_calls(tenant_id);
CREATE INDEX idx_voice_calls_lead ON voice_calls(lead_id);
CREATE INDEX idx_voice_calls_status ON voice_calls(status);
CREATE INDEX idx_voice_calls_created ON voice_calls(created_at DESC);

-- Voice conversation turns
CREATE TABLE voice_conversation_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    
    turn_number INTEGER NOT NULL,
    speaker VARCHAR(10) CHECK (speaker IN ('ai', 'human')),
    
    message TEXT NOT NULL,
    audio_url TEXT,
    
    -- AI metadata
    ai_intent_detected VARCHAR(50),
    ai_confidence DECIMAL(4,3),
    ai_response_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_turns_call ON voice_conversation_turns(call_id);

-- ============================================
-- OMNICHANNEL MESSAGING
-- ============================================

-- Channel configurations per tenant
CREATE TABLE channel_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram')),
    provider VARCHAR(50) NOT NULL, -- 'cloud_api', 'evolution', 'twilio', 'msg91', 'smtp', 'gmail', etc.
    
    -- Credentials (encrypted)
    credentials JSONB NOT NULL,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Status
    is_connected BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    last_tested_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Rate limits (override tenant defaults)
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,
    rate_limit_per_day INTEGER,
    
    -- Reputation tracking
    reputation_score INTEGER DEFAULT 100, -- 0-100
    reputation_warnings TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, channel, provider)
);

CREATE INDEX idx_channel_configs_tenant ON channel_configs(tenant_id);
CREATE INDEX idx_channel_configs_channel ON channel_configs(channel);

-- WhatsApp specific settings
CREATE TABLE whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_config_id UUID REFERENCES channel_configs(id),
    
    instance_name VARCHAR(100) NOT NULL,
    instance_type VARCHAR(20) NOT NULL CHECK (instance_type IN ('cloud_api', 'evolution')),
    
    -- Evolution API specific
    evolution_instance_id VARCHAR(255),
    qr_code TEXT,
    
    -- Cloud API specific
    phone_number_id VARCHAR(255),
    phone_number VARCHAR(50),
    waba_id VARCHAR(255),
    
    -- Status
    connection_status VARCHAR(20) DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
    quality_rating VARCHAR(20), -- Meta quality rating
    
    -- Templates (approved by Meta)
    templates JSONB DEFAULT '[]',
    
    -- Limits
    messaging_limit_tier VARCHAR(20) DEFAULT 'TIER_1',
    daily_messages_sent INTEGER DEFAULT 0,
    daily_messages_reset_at DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified inbox - all conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id),
    
    -- Channel info
    channel VARCHAR(20) NOT NULL,
    channel_provider VARCHAR(50),
    external_conversation_id VARCHAR(255), -- Provider's conversation ID
    
    -- Contact info (denormalized for quick access)
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked', 'spam')),
    
    -- Last message
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    last_message_direction VARCHAR(10), -- 'inbound', 'outbound'
    
    -- Unread count
    unread_count INTEGER DEFAULT 0,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    
    -- AI handling
    ai_handling_enabled BOOLEAN DEFAULT TRUE,
    ai_last_response_at TIMESTAMPTZ,
    ai_escalated_to_human BOOLEAN DEFAULT FALSE,
    ai_escalation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    lead_id UUID REFERENCES leads(id),
    campaign_id UUID REFERENCES campaigns(id),
    
    -- Message details
    channel VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'template', 'location', 'contact')),
    
    -- Content
    content TEXT,
    content_html TEXT, -- For email
    media_urls TEXT[],
    
    -- Template info
    template_id VARCHAR(255),
    template_namespace VARCHAR(255),
    template_params JSONB,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'blocked', 'bounced')),
    status_updated_at TIMESTAMPTZ,
    
    -- Provider tracking
    provider_message_id VARCHAR(255),
    provider_response JSONB,
    
    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- AI processing
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_intent_detected VARCHAR(50),
    ai_sentiment VARCHAR(20),
    ai_suggested_reply TEXT,
    
    -- Cost tracking
    cost DECIMAL(10,6),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Timing
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE messages_y2024m01 PARTITION OF messages
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE messages_y2024m02 PARTITION OF messages
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Add more partitions as needed

CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_lead ON messages(lead_id);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================
-- WORKFLOW AUTOMATION ENGINE
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('lead_created', 'lead_tagged', 'form_submitted', 'message_received', 'schedule', 'webhook', 'api_call', 'voice_call_completed', 'payment_received')),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    
    -- Workflow graph (nodes and edges)
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    
    -- Settings
    is_active BOOLEAN DEFAULT FALSE,
    run_once_per_lead BOOLEAN DEFAULT TRUE,
    
    -- Stats
    runs_count INTEGER DEFAULT 0,
    completions_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_trigger ON workflows(trigger_type);
CREATE INDEX idx_workflows_active ON workflows(is_active);

-- Workflow executions
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    lead_id UUID REFERENCES leads(id),
    
    -- Execution state
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    current_node_id VARCHAR(255),
    
    -- Context data
    context JSONB DEFAULT '{}', -- Variables available to nodes
    
    -- Execution log
    execution_log JSONB DEFAULT '[]', -- Array of executed nodes
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_exec_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_exec_lead ON workflow_executions(lead_id);
CREATE INDEX idx_workflow_exec_status ON workflow_executions(status);

-- Workflow node wait states (for delays, conditions)
CREATE TABLE workflow_wait_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES workflow_executions(id),
    node_id VARCHAR(255) NOT NULL,
    
    wait_type VARCHAR(20) NOT NULL CHECK (wait_type IN ('delay', 'condition', 'reply', 'event')),
    wait_config JSONB NOT NULL,
    
    resume_at TIMESTAMPTZ,
    resumed BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wait_states_resume ON workflow_wait_states(resume_at) WHERE resumed = FALSE;

-- ============================================
-- CAMPAIGNS
-- ============================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Channel & content
    channel VARCHAR(20) NOT NULL,
    message_template TEXT NOT NULL,
    message_variants JSONB DEFAULT '[]', -- For A/B testing
    
    -- Targeting
    target_type VARCHAR(20) DEFAULT 'all' CHECK (target_type IN ('all', 'segment', 'tags', 'specific')),
    target_config JSONB DEFAULT '{}',
    
    -- Scheduling
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Rate limiting
    daily_limit INTEGER,
    min_delay_seconds INTEGER DEFAULT 1,
    max_delay_seconds INTEGER DEFAULT 5,
    
    -- Stats
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    
    -- Revenue tracking
    revenue_generated DECIMAL(12,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_channel ON campaigns(channel);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at);

-- Campaign recipients
CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    lead_id UUID NOT NULL REFERENCES leads(id),
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'replied', 'converted')),
    
    -- Message variant (for A/B testing)
    variant_index INTEGER DEFAULT 0,
    
    -- Personalization
    personalized_message TEXT,
    
    -- Timing
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_lead ON campaign_recipients(lead_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- ============================================
-- QUOTA & RATE LIMITING
-- ============================================

CREATE TABLE quota_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('messages', 'api_calls', 'voice_minutes', 'workflows', 'storage')),
    channel VARCHAR(20), -- NULL for non-channel resources
    
    usage_date DATE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    
    -- Limits (copied from tenant at start of day)
    daily_limit INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, resource_type, channel, usage_date)
);

CREATE INDEX idx_quota_usage_tenant ON quota_usage(tenant_id);
CREATE INDEX idx_quota_usage_date ON quota_usage(usage_date);

-- Rate limit tracking (sliding window)
CREATE TABLE rate_limit_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    resource_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20),
    
    window_start TIMESTAMPTZ NOT NULL,
    window_duration_minutes INTEGER NOT NULL,
    
    request_count INTEGER DEFAULT 0,
    limit_count INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_lookup ON rate_limit_windows(tenant_id, resource_type, channel, window_start);

-- ============================================
-- ANTI-BAN & REPUTATION
-- ============================================

CREATE TABLE reputation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    channel VARCHAR(20) NOT NULL,
    channel_provider VARCHAR(50) NOT NULL,
    
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('block', 'report_spam', 'unsubscribe', 'bounce', 'complaint', 'hard_bounce')),
    event_severity INTEGER NOT NULL CHECK (event_severity BETWEEN 1 AND 10),
    
    lead_id UUID REFERENCES leads(id),
    message_id UUID REFERENCES messages(id),
    
    event_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reputation_events_tenant ON reputation_events(tenant_id);
CREATE INDEX idx_reputation_events_channel ON reputation_events(channel);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
CREATE INDEX idx_reputation_events_created ON reputation_events(created_at);

-- Channel health status
CREATE TABLE channel_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    channel_provider VARCHAR(50) NOT NULL,
    
    -- Health metrics
    reputation_score INTEGER DEFAULT 100 CHECK (reputation_score BETWEEN 0 AND 100),
    health_status VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN reputation_score >= 80 THEN 'healthy'
            WHEN reputation_score >= 50 THEN 'warning'
            ELSE 'critical'
        END
    ) STORED,
    
    -- Metrics (rolling 24h)
    messages_sent_24h INTEGER DEFAULT 0,
    messages_failed_24h INTEGER DEFAULT 0,
    blocks_24h INTEGER DEFAULT 0,
    spam_reports_24h INTEGER DEFAULT 0,
    bounces_24h INTEGER DEFAULT 0,
    
    -- Auto-pause settings
    auto_pause_enabled BOOLEAN DEFAULT TRUE,
    auto_pause_threshold INTEGER DEFAULT 50, -- Pause if reputation drops below this
    
    -- Current state
    is_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMPTZ,
    paused_reason TEXT,
    
    -- Warm-up mode
    warmup_mode BOOLEAN DEFAULT FALSE,
    warmup_day INTEGER DEFAULT 0,
    warmup_daily_limit INTEGER,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, channel, channel_provider)
);

CREATE INDEX idx_channel_health_tenant ON channel_health(tenant_id);
CREATE INDEX idx_channel_health_status ON channel_health(health_status);

-- ============================================
-- AI CONVERSATIONS
-- ============================================

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id),
    conversation_id UUID REFERENCES conversations(id),
    
    -- AI configuration
    ai_model VARCHAR(50) DEFAULT 'gpt-4',
    system_prompt TEXT,
    
    -- Conversation state
    context JSONB DEFAULT '{}', -- Variables like {name, product, pricing}
    conversation_history JSONB DEFAULT '[]', -- Last N messages for context
    
    -- Intent tracking
    detected_intents JSONB DEFAULT '[]',
    current_intent VARCHAR(50),
    intent_confidence DECIMAL(4,3),
    
    -- Handoff
    handoff_to_human BOOLEAN DEFAULT FALSE,
    handoff_reason TEXT,
    handoff_requested_at TIMESTAMPTZ,
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    ai_response_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_lead ON ai_conversations(lead_id);
CREATE INDEX idx_ai_conversations_handoff ON ai_conversations(handoff_to_human) WHERE handoff_to_human = FALSE;

-- AI knowledge base
CREATE TABLE ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    
    -- Vector embedding for semantic search
    embedding VECTOR(1536), -- Requires pgvector extension
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_tenant ON ai_knowledge_base(tenant_id);
CREATE INDEX idx_kb_category ON ai_knowledge_base(category);

-- ============================================
-- PAYMENTS & BILLING
-- ============================================

CREATE TABLE payment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Provider
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('stripe', 'razorpay', 'paypal')),
    provider_product_id VARCHAR(255),
    provider_price_id VARCHAR(255),
    
    -- Link settings
    checkout_url TEXT,
    success_url TEXT,
    cancel_url TEXT,
    
    -- AI upsell
    ai_upsell_enabled BOOLEAN DEFAULT FALSE,
    ai_upsell_message TEXT,
    
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id),
    payment_link_id UUID REFERENCES payment_links(id),
    campaign_id UUID REFERENCES campaigns(id),
    
    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    provider VARCHAR(20) NOT NULL,
    provider_payment_id VARCHAR(255),
    provider_checkout_session_id VARCHAR(255),
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Attribution
    attributed_to_message_id UUID REFERENCES messages(id),
    attributed_to_campaign_id UUID REFERENCES campaigns(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_lead ON payments(lead_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================
-- ANALYTICS & EVENTS
-- ============================================

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- 'message', 'lead', 'campaign', 'payment', 'workflow'
    
    -- References
    lead_id UUID REFERENCES leads(id),
    campaign_id UUID REFERENCES campaigns(id),
    message_id UUID REFERENCES messages(id),
    workflow_id UUID REFERENCES workflows(id),
    
    -- Event data
    event_data JSONB,
    
    -- User/Session
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for analytics
CREATE TABLE analytics_y2024m01 PARTITION OF analytics_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_analytics_tenant ON analytics_events(tenant_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_category ON analytics_events(event_category);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- Daily aggregated stats (for fast dashboard queries)
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    stat_date DATE NOT NULL,
    
    -- Message stats
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_read INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    
    -- Lead stats
    leads_created INTEGER DEFAULT 0,
    leads_qualified INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    
    -- Campaign stats
    campaigns_sent INTEGER DEFAULT 0,
    campaign_revenue DECIMAL(12,2) DEFAULT 0,
    
    -- Channel breakdown
    channel_stats JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, stat_date)
);

CREATE INDEX idx_daily_stats_tenant ON daily_stats(tenant_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(stat_date);

-- ============================================
-- TEMPLATES & MARKETPLACE
-- ============================================

CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for marketplace templates
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    category VARCHAR(100),
    tags TEXT[],
    
    -- Content
    content TEXT NOT NULL,
    content_html TEXT, -- For email
    variables JSONB DEFAULT '[]', -- [{"name": "firstName", "type": "text"}]
    
    -- Channel support
    supported_channels TEXT[],
    
    -- Marketplace
    is_public BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    price DECIMAL(10,2),
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,
    
    -- Approval (for Meta templates)
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_tenant ON message_templates(tenant_id);
CREATE INDEX idx_templates_public ON message_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_templates_category ON message_templates(category);

-- ============================================
-- TEAM & COLLABORATION
-- ============================================

CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'agent',
    
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    
    invited_by UUID REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    user_id UUID REFERENCES users(id),
    
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'login', 'export'
    resource_type VARCHAR(50) NOT NULL, -- 'lead', 'campaign', 'message', etc.
    resource_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- WEBHOOKS
-- ============================================

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    
    events TEXT[] NOT NULL, -- ['lead.created', 'message.sent', etc.]
    
    secret VARCHAR(255), -- For HMAC signature
    
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Stats
    last_triggered_at TIMESTAMPTZ,
    last_status_code INTEGER,
    last_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channel_configs_updated_at BEFORE UPDATE ON channel_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Partition maintenance function
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := p_table_name || '_y' || p_year || 'm' || LPAD(p_month::TEXT, 2, '0');
    start_date := MAKE_DATE(p_year, p_month, 1);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        p_table_name,
        start_date,
        end_date
    );
END;
$$ LANGUAGE plpgsql;
