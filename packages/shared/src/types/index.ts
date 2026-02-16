// ============================================
// BeeCastly Shared Types
// Shared between API and Web packages
// ============================================

// ============================================
// Core Entity Types
// ============================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  whitelabelEnabled: boolean;
  customDomain?: string;
  maxContacts: number;
  maxMessagesPerDay: number;
  maxWorkflows: number;
  maxTeamMembers: number;
  settings: TenantSettings;
  branding?: TenantBranding;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  language: string;
  dateFormat: string;
  emailNotifications: boolean;
  webhookUrl?: string;
  aiEnabled: boolean;
  autoReplyEnabled: boolean;
}

export interface TenantBranding {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  customCss?: string;
  senderName?: string;
  senderEmail?: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'pending';
  permissions: Permission[];
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent' | 'viewer';

export type Permission =
  | 'leads:read' | 'leads:write' | 'leads:delete' | 'leads:import' | 'leads:export'
  | 'contacts:read' | 'contacts:write' | 'contacts:delete' | 'contacts:import' | 'contacts:export'
  | 'campaigns:read' | 'campaigns:write' | 'campaigns:delete' | 'campaigns:launch'
  | 'workflows:read' | 'workflows:write' | 'workflows:delete' | 'workflows:activate'
  | 'messages:read' | 'messages:write' | 'messages:send'
  | 'templates:read' | 'templates:write' | 'templates:delete'
  | 'analytics:read' | 'analytics:export'
  | 'team:read' | 'team:write' | 'team:delete'
  | 'billing:read' | 'billing:write'
  | 'settings:read' | 'settings:write'
  | 'api:manage';

// ============================================
// Lead Types
// ============================================

export interface Lead {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  telegramUsername?: string;
  company?: string;
  jobTitle?: string;
  source: LeadSource;
  status: LeadStatus;
  temperature: 'cold' | 'warm' | 'hot';
  score: LeadScore;
  aiQualification?: AIQualification;
  customFields: Record<string, any>;
  tags: string[];
  assignedTo?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadSource =
  | 'website'
  | 'landing_page'
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'google_ads'
  | 'organic'
  | 'referral'
  | 'manual'
  | 'api'
  | 'import';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'nurturing'
  | 'dormant';

export interface LeadScore {
  total: number;
  behavior: number;
  engagement: number;
  demographic: number;
  lastCalculatedAt: string;
}

export interface AIQualification {
  score: number;
  intent: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category?: string;
  summary?: string;
  nextBestAction?: string;
  qualifiedAt: string;
}

export interface LeadCaptureForm {
  id: string;
  tenantId: string;
  name: string;
  fields: FormField[];
  aiQualificationEnabled: boolean;
  autoTag?: string[];
  autoAssign?: string;
  webhookUrl?: string;
  redirectUrl?: string;
  styling: FormStyling;
  embedCode: string;
  submissions: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface FormStyling {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  buttonText: string;
  successMessage: string;
}

// ============================================
// Messaging Types
// ============================================

export type MessageChannel = 'whatsapp' | 'sms' | 'email' | 'telegram' | 'voice';

export interface Conversation {
  id: string;
  tenantId: string;
  leadId: string;
  channel: MessageChannel;
  channelId: string;
  status: 'active' | 'closed' | 'archived' | 'spam';
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  assignedTo?: string;
  aiEnabled: boolean;
  aiContext?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  channel: MessageChannel;
  direction: 'inbound' | 'outbound';
  content: string;
  contentType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'template';
  mediaUrl?: string;
  mediaCaption?: string;
  status: MessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  failReason?: string;
  aiProcessed: boolean;
  aiIntent?: string;
  aiSentiment?: 'positive' | 'neutral' | 'negative';
  aiResponse?: string;
  templateId?: string;
  campaignId?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export type MessageStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: 'marketing' | 'utility' | 'authentication';
  channel: MessageChannel;
  language: string;
  content: string;
  variables: TemplateVariable[];
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    content: string;
  };
  buttons?: TemplateButton[];
  footer?: string;
  whatsappTemplateId?: string;
  whatsappStatus?: 'pending' | 'approved' | 'rejected';
  usageCount: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency';
  required: boolean;
  defaultValue?: string;
}

export interface TemplateButton {
  type: 'quick_reply' | 'url' | 'phone';
  text: string;
  value?: string;
}

// ============================================
// Campaign Types
// ============================================

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'broadcast' | 'sequence' | 'recurring';
  channel: MessageChannel;
  status: CampaignStatus;
  templateId: string;
  audience: CampaignAudience;
  schedule?: CampaignSchedule;
  abTest?: ABTestConfig;
  stats: CampaignStats;
  sentBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface CampaignAudience {
  segmentId?: string;
  filter?: LeadFilter;
  leadIds?: string[];
  estimatedCount: number;
}

export interface LeadFilter {
  tags?: string[];
  status?: LeadStatus[];
  temperature?: string[];
  source?: LeadSource[];
  scoreMin?: number;
  scoreMax?: number;
  lastActivityAfter?: string;
  lastActivityBefore?: string;
  customFields?: Record<string, any>;
}

export interface CampaignSchedule {
  type: 'immediate' | 'once' | 'recurring';
  startAt?: string;
  endAt?: string;
  timezone: string;
  cronExpression?: string;
  throttleRate?: number;
}

export interface ABTestConfig {
  enabled: boolean;
  variants: ABVariant[];
  testPercentage: number;
  winningCriteria: 'open_rate' | 'click_rate' | 'reply_rate';
  testDuration: number;
}

export interface ABVariant {
  id: string;
  name: string;
  templateId: string;
  percentage: number;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
  cost: number;
  revenue?: number;
}

// ============================================
// Workflow Types
// ============================================

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  stats: WorkflowStats;
  lastRunAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, any>;
}

export type WorkflowTriggerType =
  | 'lead_created'
  | 'lead_updated'
  | 'tag_added'
  | 'tag_removed'
  | 'message_received'
  | 'message_sent'
  | 'conversation_started'
  | 'conversation_closed'
  | 'campaign_completed'
  | 'form_submitted'
  | 'webhook_called'
  | 'schedule'
  | 'api_call';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export type WorkflowNodeType =
  | 'trigger'
  | 'send_message'
  | 'send_email'
  | 'make_call'
  | 'add_tag'
  | 'remove_tag'
  | 'update_lead'
  | 'create_task'
  | 'notify_user'
  | 'webhook'
  | 'ai_agent'
  | 'condition'
  | 'delay'
  | 'wait_for_reply'
  | 'split_path'
  | 'end';

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  condition?: string;
}

export interface WorkflowStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  tenantId: string;
  leadId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  context: Record<string, any>;
  nodeResults: NodeExecutionResult[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  executedAt: string;
}

// ============================================
// Voice Call Types
// ============================================

export interface VoiceCall {
  id: string;
  tenantId: string;
  leadId: string;
  conversationId?: string;
  campaignId?: string;
  workflowExecutionId?: string;
  direction: 'inbound' | 'outbound';
  status: CallStatus;
  fromNumber: string;
  toNumber: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  recordingUrl?: string;
  recordingDuration?: number;
  transcript?: string;
  aiEnabled: boolean;
  aiScript?: string;
  aiSummary?: string;
  aiSentiment?: 'positive' | 'neutral' | 'negative';
  aiOutcome?: string;
  cost: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export type CallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no_answer'
  | 'cancelled';

export interface CallScript {
  id: string;
  tenantId: string;
  name: string;
  greeting: string;
  talkingPoints: string[];
  questions: string[];
  objections: Record<string, string>;
  closing: string;
  aiPrompt: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  language: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsDashboard {
  tenantId: string;
  period: { start: string; end: string };
  overview: OverviewStats;
  channels: ChannelStats[];
  campaigns: CampaignPerformance[];
  workflows: WorkflowPerformance[];
  leads: LeadAnalytics;
  team: TeamPerformance[];
  revenue: RevenueStats;
}

export interface OverviewStats {
  totalLeads: number;
  newLeads: number;
  totalConversations: number;
  totalMessages: number;
  totalCalls: number;
  avgResponseTime: number;
  conversionRate: number;
}

export interface ChannelStats {
  channel: MessageChannel;
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesReplied: number;
  cost: number;
  revenue: number;
  roi: number;
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked: number;
  conversionRate: number;
  cost: number;
  revenue: number;
  roi: number;
}

export interface WorkflowPerformance {
  workflowId: string;
  workflowName: string;
  executions: number;
  completions: number;
  avgExecutionTime: number;
  leadsConverted: number;
  revenue: number;
}

export interface LeadAnalytics {
  bySource: Record<LeadSource, number>;
  byStatus: Record<LeadStatus, number>;
  byTemperature: Record<string, number>;
  conversionFunnel: FunnelStage[];
  topTags: { tag: string; count: number }[];
}

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface TeamPerformance {
  userId: string;
  userName: string;
  conversationsHandled: number;
  messagesSent: number;
  avgResponseTime: number;
  leadsConverted: number;
  customerSatisfaction: number;
}

export interface RevenueStats {
  totalRevenue: number;
  revenueByChannel: Record<MessageChannel, number>;
  revenueByCampaign: Record<string, number>;
  revenueByWorkflow: Record<string, number>;
  mrr: number;
  arr: number;
}

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

// ============================================
// Team & Collaboration Types
// ============================================

export interface TeamMember {
  id: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  department?: string;
  permissions: Permission[];
  assignedChannels: MessageChannel[];
  maxConcurrentChats: number;
  workingHours?: WorkingHours;
  status: 'active' | 'away' | 'offline';
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingHours {
  timezone: string;
  schedule: DaySchedule[];
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdBy: string;
  leadId?: string;
  conversationId?: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mention {
  id: string;
  tenantId: string;
  messageId: string;
  mentionedUserId: string;
  mentionedBy: string;
  read: boolean;
  createdAt: string;
}

// ============================================
// Billing & Quota Types
// ============================================

export interface Subscription {
  id: string;
  tenantId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'paused';
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: PaymentMethod;
  usage: UsageStats;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  features: PlanFeature[];
  limits: PlanLimits;
}

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number;
}

export interface PlanLimits {
  maxContacts: number;
  maxMessagesPerDay: number;
  maxWorkflows: number;
  maxTeamMembers: number;
  maxCampaigns: number;
  aiCreditsPerMonth: number;
  voiceMinutesPerMonth: number;
  apiCallsPerDay: number;
}

export interface UsageStats {
  contacts: number;
  messagesSent: number;
  messagesReceived: number;
  voiceMinutes: number;
  aiCredits: number;
  apiCalls: number;
  storageBytes: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_transfer' | 'upi';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  items: InvoiceItem[];
  pdfUrl?: string;
  paidAt?: string;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  period?: { start: string; end: string };
}

export interface QuotaUsage {
  tenantId: string;
  resource: string;
  limit: number;
  used: number;
  remaining: number;
  resetsAt?: string;
}

// ============================================
// API Key & Webhook Types
// ============================================

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPreview: string;
  permissions: Permission[];
  allowedIps?: string[];
  rateLimit?: number;
  lastUsedAt?: string;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  retryConfig: RetryConfig;
  stats: WebhookStats;
  createdAt: string;
  updatedAt: string;
}

export type WebhookEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'conversation.started'
  | 'conversation.closed'
  | 'campaign.started'
  | 'campaign.completed'
  | 'workflow.executed'
  | 'call.completed'
  | 'form.submitted';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryMultiplier: number;
}

export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  responseStatus?: number;
  responseBody?: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  createdAt: string;
  deliveredAt?: string;
}

// ============================================
// Template Marketplace Types
// ============================================

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  author: TemplateAuthor;
  rating: number;
  reviewCount: number;
  downloadCount: number;
  price: number;
  currency: string;
  content: any;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateAuthor {
  id: string;
  name: string;
  avatar?: string;
  verified: boolean;
}

// ============================================
// AI Types
// ============================================

export interface AIConversation {
  id: string;
  tenantId: string;
  leadId: string;
  conversationId: string;
  status: 'active' | 'paused' | 'ended';
  context: AIContext;
  messages: AIChatMessage[];
  intentHistory: string[];
  handoffRequested: boolean;
  handoffReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIContext {
  leadInfo: Record<string, any>;
  conversationHistory: string;
  currentGoal?: string;
  collectedData: Record<string, any>;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  entities?: Record<string, any>;
}

export interface IntentDetectionResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  suggestedResponse?: string;
  shouldHandoff: boolean;
  handoffReason?: string;
}

// ============================================
// Anti-Spam & Reputation Types
// ============================================

export interface ReputationScore {
  tenantId: string;
  channel: MessageChannel;
  score: number;
  factors: ReputationFactor[];
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  recommendations: string[];
  updatedAt: string;
}

export interface ReputationFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface RateLimitStatus {
  tenantId: string;
  resource: string;
  limit: number;
  window: number;
  remaining: number;
  resetAt: string;
}

// ============================================
// Pagination & API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationInfo;
  };
}

// ============================================
// Socket Event Types
// ============================================

export interface SocketEvents {
  // Client to Server
  'conversation:join': (conversationId: string) => void;
  'conversation:leave': (conversationId: string) => void;
  'conversation:typing': (data: { conversationId: string; isTyping: boolean }) => void;
  'message:send': (data: { conversationId: string; content: string }) => void;

  // Server to Client
  'message:received': (message: Message) => void;
  'message:status': (data: { messageId: string; status: MessageStatus }) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'notification:new': (notification: Notification) => void;
  'lead:updated': (lead: Lead) => void;
  'workflow:executed': (execution: WorkflowExecution) => void;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

// ============================================
// Settings Types
// ============================================

export interface ChannelSettings {
  whatsapp: WhatsAppSettings;
  sms: SMSSettings;
  email: EmailSettings;
  telegram: TelegramSettings;
  voice: VoiceSettings;
}

export interface WhatsAppSettings {
  provider: 'cloud_api' | 'evolution_api';
  cloudApi?: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
  };
  evolutionApi?: {
    instanceName: string;
    endpoint: string;
    apiKey: string;
  };
  webhookUrl?: string;
  enabled: boolean;
}

export interface SMSSettings {
  provider: 'twilio' | 'msg91' | 'fast2sms' | 'aws_sns';
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  msg91?: {
    authKey: string;
    senderId: string;
  };
  fast2sms?: {
    apiKey: string;
    senderId: string;
  };
  awsSns?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  enabled: boolean;
}

export interface EmailSettings {
  provider: 'smtp' | 'gmail' | 'sendgrid' | 'mailgun';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  gmail?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  sendgrid?: {
    apiKey: string;
  };
  mailgun?: {
    apiKey: string;
    domain: string;
  };
  defaultFrom: string;
  defaultFromName: string;
  enabled: boolean;
}

export interface TelegramSettings {
  botToken: string;
  botUsername: string;
  webhookUrl?: string;
  enabled: boolean;
}

export interface VoiceSettings {
  provider: 'twilio';
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  openai: {
    apiKey: string;
    model: string;
    voice: string;
  };
  enabled: boolean;
}
