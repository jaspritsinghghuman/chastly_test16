// ============================================
// API Request/Response Types
// Shared between API and Web packages
// ============================================

import type {
  Lead,
  LeadCaptureForm,
  Conversation,
  Message,
  MessageTemplate,
  Campaign,
  Workflow,
  WorkflowExecution,
  VoiceCall,
  Task,
  TeamMember,
  User,
  Tenant,
  ApiKey,
  Webhook,
  PaginatedResponse,
  LeadFilter,
  CampaignAudience,
  CampaignSchedule,
  ABTestConfig,
  WorkflowNode,
  WorkflowEdge,
  WorkflowTrigger,
  AnalyticsDashboard,
  Subscription,
  Invoice,
  QuotaUsage,
  Notification,
  MessageChannel,
  LeadStatus,
  UserRole,
  Permission,
  ChannelSettings,
} from '../types';

// ============================================
// Auth API
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName?: string;
  plan?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
}

// ============================================
// Lead API
// ============================================

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  telegramUsername?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  status?: LeadStatus;
  tags?: string[];
  customFields?: Record<string, any>;
  assignedTo?: string;
}

export interface UpdateLeadRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  telegramUsername?: string;
  company?: string;
  jobTitle?: string;
  status?: LeadStatus;
  tags?: string[];
  customFields?: Record<string, any>;
  assignedTo?: string;
}

export interface ListLeadsRequest {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus | LeadStatus[];
  source?: string | string[];
  tags?: string | string[];
  assignedTo?: string;
  temperature?: string;
  scoreMin?: number;
  scoreMax?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type ListLeadsResponse = PaginatedResponse<Lead>;

export interface BulkUpdateLeadsRequest {
  leadIds: string[];
  updates: Partial<UpdateLeadRequest>;
}

export interface ImportLeadsRequest {
  file: File;
  mapping: Record<string, string>;
  tags?: string[];
  source?: string;
  skipDuplicates?: boolean;
}

export interface ImportLeadsResponse {
  jobId: string;
  totalRows: number;
}

export interface ExportLeadsRequest {
  filter?: LeadFilter;
  format: 'csv' | 'xlsx' | 'json';
  fields?: string[];
}

export interface ExportLeadsResponse {
  jobId: string;
  downloadUrl?: string;
}

// ============================================
// Lead Capture Form API
// ============================================

export interface CreateFormRequest {
  name: string;
  fields: any[];
  aiQualificationEnabled?: boolean;
  autoTag?: string[];
  autoAssign?: string;
  webhookUrl?: string;
  redirectUrl?: string;
  styling?: any;
}

export interface UpdateFormRequest extends Partial<CreateFormRequest> {}

export interface SubmitFormRequest {
  formId: string;
  data: Record<string, any>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
    utm?: Record<string, string>;
  };
}

export interface SubmitFormResponse {
  success: boolean;
  leadId?: string;
  message?: string;
  redirectUrl?: string;
}

// ============================================
// Conversation & Message API
// ============================================

export interface ListConversationsRequest {
  page?: number;
  limit?: number;
  leadId?: string;
  channel?: MessageChannel;
  status?: string;
  assignedTo?: string;
  unreadOnly?: boolean;
  search?: string;
}

export type ListConversationsResponse = PaginatedResponse<Conversation>;

export interface SendMessageRequest {
  conversationId?: string;
  leadId?: string;
  channel: MessageChannel;
  content: string;
  contentType?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
}

export interface SendBulkMessagesRequest {
  leadIds: string[];
  channel: MessageChannel;
  content: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  throttleRate?: number;
}

export interface SendBulkMessagesResponse {
  jobId: string;
  totalLeads: number;
  estimatedTime: number;
}

export interface MarkAsReadRequest {
  messageIds: string[];
}

// ============================================
// Template API
// ============================================

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category: 'marketing' | 'utility' | 'authentication';
  channel: MessageChannel;
  language: string;
  content: string;
  variables?: any[];
  header?: any;
  buttons?: any[];
  footer?: string;
  isPublic?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface ListTemplatesRequest {
  page?: number;
  limit?: number;
  channel?: MessageChannel;
  category?: string;
  search?: string;
}

export type ListTemplatesResponse = PaginatedResponse<MessageTemplate>;

// ============================================
// Campaign API
// ============================================

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  type: 'broadcast' | 'sequence' | 'recurring';
  channel: MessageChannel;
  templateId: string;
  audience: CampaignAudience;
  schedule?: CampaignSchedule;
  abTest?: ABTestConfig;
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {}

export interface LaunchCampaignRequest {
  campaignId: string;
  immediate?: boolean;
}

export interface LaunchCampaignResponse {
  success: boolean;
  jobId?: string;
  estimatedTime?: number;
  message?: string;
}

export interface PauseCampaignRequest {
  campaignId: string;
}

export interface ResumeCampaignRequest {
  campaignId: string;
}

export interface CancelCampaignRequest {
  campaignId: string;
}

export interface ListCampaignsRequest {
  page?: number;
  limit?: number;
  status?: string;
  channel?: MessageChannel;
  search?: string;
}

export type ListCampaignsResponse = PaginatedResponse<Campaign>;

export interface GetCampaignStatsResponse {
  campaignId: string;
  stats: Campaign['stats'];
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  }>;
}

// ============================================
// Workflow API
// ============================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface UpdateWorkflowRequest extends Partial<CreateWorkflowRequest> {}

export interface ActivateWorkflowRequest {
  workflowId: string;
}

export interface DeactivateWorkflowRequest {
  workflowId: string;
}

export interface ListWorkflowsRequest {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export type ListWorkflowsResponse = PaginatedResponse<Workflow>;

export interface ListWorkflowExecutionsRequest {
  workflowId: string;
  page?: number;
  limit?: number;
  status?: string;
  leadId?: string;
}

export type ListWorkflowExecutionsResponse = PaginatedResponse<WorkflowExecution>;

export interface TestWorkflowRequest {
  workflowId: string;
  leadId: string;
  testData?: Record<string, any>;
}

export interface TestWorkflowResponse {
  executionId: string;
  results: any[];
  success: boolean;
}

// ============================================
// Voice Call API
// ============================================

export interface MakeCallRequest {
  leadId: string;
  scriptId?: string;
  customScript?: string;
  aiEnabled?: boolean;
}

export interface MakeCallResponse {
  callId: string;
  status: string;
  estimatedDuration?: number;
}

export interface ListCallsRequest {
  page?: number;
  limit?: number;
  leadId?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
}

export type ListCallsResponse = PaginatedResponse<VoiceCall>;

export interface CreateCallScriptRequest {
  name: string;
  greeting: string;
  talkingPoints: string[];
  questions: string[];
  objections: Record<string, string>;
  closing: string;
  aiPrompt: string;
  voice?: string;
  language?: string;
}

export interface UpdateCallScriptRequest extends Partial<CreateCallScriptRequest> {}

// ============================================
// Analytics API
// ============================================

export interface GetAnalyticsRequest {
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface GetAnalyticsResponse extends AnalyticsDashboard {}

export interface GetRealtimeStatsResponse {
  activeConversations: number;
  onlineAgents: number;
  messagesToday: number;
  leadsToday: number;
  callsOngoing: number;
}

// ============================================
// Team API
// ============================================

export interface InviteTeamMemberRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions?: Permission[];
  department?: string;
}

export interface UpdateTeamMemberRequest {
  role?: UserRole;
  permissions?: Permission[];
  department?: string;
  assignedChannels?: MessageChannel[];
  maxConcurrentChats?: number;
  workingHours?: any;
}

export interface ListTeamMembersRequest {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: string;
  search?: string;
}

export type ListTeamMembersResponse = PaginatedResponse<TeamMember>;

// ============================================
// Task API
// ============================================

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  leadId?: string;
  conversationId?: string;
  dueAt?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ListTasksRequest {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  leadId?: string;
}

export type ListTasksResponse = PaginatedResponse<Task>;

// ============================================
// Settings API
// ============================================

export interface UpdateTenantSettingsRequest {
  name?: string;
  settings?: Partial<Tenant['settings']>;
  branding?: Partial<Tenant['branding']>;
}

export interface UpdateChannelSettingsRequest {
  whatsapp?: Partial<ChannelSettings['whatsapp']>;
  sms?: Partial<ChannelSettings['sms']>;
  email?: Partial<ChannelSettings['email']>;
  telegram?: Partial<ChannelSettings['telegram']>;
  voice?: Partial<ChannelSettings['voice']>;
}

export interface TestChannelRequest {
  channel: MessageChannel;
  to: string;
  message?: string;
}

// ============================================
// Billing API
// ============================================

export interface GetSubscriptionResponse {
  subscription: Subscription;
  usage: any;
  upcomingInvoice?: Invoice;
}

export interface UpdateSubscriptionRequest {
  planId: string;
  billingCycle?: 'monthly' | 'yearly';
}

export interface ListInvoicesRequest {
  page?: number;
  limit?: number;
  status?: string;
}

export type ListInvoicesResponse = PaginatedResponse<Invoice>;

export interface GetQuotaUsageResponse {
  quotas: QuotaUsage[];
}

// ============================================
// API Keys API
// ============================================

export interface CreateApiKeyRequest {
  name: string;
  permissions?: Permission[];
  allowedIps?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string;
}

export interface RevokeApiKeyRequest {
  keyId: string;
}

export interface ListApiKeysRequest {
  page?: number;
  limit?: number;
}

export type ListApiKeysResponse = PaginatedResponse<ApiKey>;

// ============================================
// Webhook API
// ============================================

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  retryConfig?: any;
}

export interface UpdateWebhookRequest extends Partial<CreateWebhookRequest> {}

export interface TestWebhookRequest {
  webhookId: string;
  event?: string;
}

export interface TestWebhookResponse {
  success: boolean;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export interface ListWebhooksRequest {
  page?: number;
  limit?: number;
  active?: boolean;
}

export type ListWebhooksResponse = PaginatedResponse<Webhook>;

export interface ListWebhookDeliveriesRequest {
  webhookId: string;
  page?: number;
  limit?: number;
  status?: string;
}

// ============================================
// Notification API
// ============================================

export interface ListNotificationsRequest {
  page?: number;
  limit?: number;
  read?: boolean;
}

export type ListNotificationsResponse = PaginatedResponse<Notification>;

export interface MarkNotificationsReadRequest {
  notificationIds?: string[];
  markAll?: boolean;
}

// ============================================
// Public API
// ============================================

export interface PublicApiHeaders {
  'X-API-Key': string;
  'X-Tenant-ID'?: string;
}

export interface PublicCreateLeadRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface PublicSendMessageRequest {
  leadId: string;
  channel: MessageChannel;
  content: string;
}

export interface PublicWebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  signature: string;
}
