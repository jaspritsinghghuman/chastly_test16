// ============================================
// BeeCastly Constants
// Shared between API and Web packages
// ============================================

// ============================================
// Plans & Pricing
// ============================================

export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out BeeCastly',
    price: 0,
    currency: 'USD',
    limits: {
      maxContacts: 100,
      maxMessagesPerDay: 50,
      maxWorkflows: 2,
      maxTeamMembers: 1,
      maxCampaigns: 1,
      aiCreditsPerMonth: 0,
      voiceMinutesPerMonth: 0,
      apiCallsPerDay: 100,
    },
    features: [
      'WhatsApp messaging',
      'Email campaigns',
      'Basic templates',
      'Contact management',
      'Basic analytics',
    ],
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    description: 'For small businesses getting started',
    price: 29,
    currency: 'USD',
    limits: {
      maxContacts: 1000,
      maxMessagesPerDay: 500,
      maxWorkflows: 10,
      maxTeamMembers: 3,
      maxCampaigns: 5,
      aiCreditsPerMonth: 500,
      voiceMinutesPerMonth: 60,
      apiCallsPerDay: 1000,
    },
    features: [
      'All Free features',
      'SMS messaging',
      'Telegram bot',
      'Basic workflows',
      'Lead scoring',
      'Team collaboration',
    ],
  },
  GROWTH: {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses',
    price: 99,
    currency: 'USD',
    limits: {
      maxContacts: 10000,
      maxMessagesPerDay: 5000,
      maxWorkflows: 50,
      maxTeamMembers: 10,
      maxCampaigns: 25,
      aiCreditsPerMonth: 5000,
      voiceMinutesPerMonth: 500,
      apiCallsPerDay: 10000,
    },
    features: [
      'All Starter features',
      'AI lead qualification',
      'Voice calls',
      'Advanced workflows',
      'A/B testing',
      'API access',
      'Webhooks',
    ],
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 299,
    currency: 'USD',
    limits: {
      maxContacts: 100000,
      maxMessagesPerDay: 50000,
      maxWorkflows: 500,
      maxTeamMembers: 50,
      maxCampaigns: 100,
      aiCreditsPerMonth: 50000,
      voiceMinutesPerMonth: 5000,
      apiCallsPerDay: 100000,
    },
    features: [
      'All Growth features',
      'White-label option',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Advanced security',
      'Custom contracts',
    ],
  },
} as const;

// ============================================
// Message Channels
// ============================================

export const MESSAGE_CHANNELS = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  EMAIL: 'email',
  TELEGRAM: 'telegram',
  VOICE: 'voice',
} as const;

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  telegram: 'Telegram',
  voice: 'Voice Call',
};

export const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: 'MessageCircle',
  sms: 'Smartphone',
  email: 'Mail',
  telegram: 'Send',
  voice: 'Phone',
};

export const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  sms: '#3B82F6',
  email: '#EF4444',
  telegram: '#0088CC',
  voice: '#8B5CF6',
};

// ============================================
// Lead Status
// ============================================

export const LEAD_STATUSES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  WON: 'won',
  LOST: 'lost',
  NURTURING: 'nurturing',
  DORMANT: 'dormant',
} as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  nurturing: 'Nurturing',
  dormant: 'Dormant',
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  contacted: '#8B5CF6',
  qualified: '#10B981',
  proposal: '#F59E0B',
  negotiation: '#EC4899',
  won: '#059669',
  lost: '#6B7280',
  nurturing: '#6366F1',
  dormant: '#9CA3AF',
};

// ============================================
// Lead Temperature
// ============================================

export const LEAD_TEMPERATURES = {
  COLD: 'cold',
  WARM: 'warm',
  HOT: 'hot',
} as const;

export const LEAD_TEMPERATURE_LABELS: Record<string, string> = {
  cold: 'Cold',
  warm: 'Warm',
  hot: 'Hot',
};

export const LEAD_TEMPERATURE_COLORS: Record<string, string> = {
  cold: '#3B82F6',
  warm: '#F59E0B',
  hot: '#EF4444',
};

// ============================================
// Lead Sources
// ============================================

export const LEAD_SOURCES = {
  WEBSITE: 'website',
  LANDING_PAGE: 'landing_page',
  WHATSAPP: 'whatsapp',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  GOOGLE_ADS: 'google_ads',
  ORGANIC: 'organic',
  REFERRAL: 'referral',
  MANUAL: 'manual',
  API: 'api',
  IMPORT: 'import',
} as const;

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  landing_page: 'Landing Page',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_ads: 'Google Ads',
  organic: 'Organic Search',
  referral: 'Referral',
  manual: 'Manual Entry',
  api: 'API',
  import: 'Import',
};

// ============================================
// User Roles & Permissions
// ============================================

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  VIEWER: 'viewer',
} as const;

export const USER_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
  viewer: 'Viewer',
};

export const USER_ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  agent: 40,
  viewer: 20,
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  admin: [
    'leads:*',
    'contacts:*',
    'campaigns:*',
    'workflows:*',
    'messages:*',
    'templates:*',
    'analytics:*',
    'team:*',
    'billing:read',
    'settings:*',
    'api:manage',
  ],
  manager: [
    'leads:*',
    'contacts:*',
    'campaigns:*',
    'workflows:read',
    'workflows:write',
    'messages:*',
    'templates:*',
    'analytics:*',
    'team:read',
    'settings:read',
  ],
  agent: [
    'leads:read',
    'leads:write',
    'contacts:read',
    'contacts:write',
    'messages:read',
    'messages:write',
    'messages:send',
    'templates:read',
    'analytics:read',
  ],
  viewer: [
    'leads:read',
    'contacts:read',
    'messages:read',
    'analytics:read',
  ],
};

// ============================================
// Campaign Status
// ============================================

export const CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  scheduled: '#3B82F6',
  running: '#10B981',
  paused: '#F59E0B',
  completed: '#059669',
  cancelled: '#EF4444',
};

// ============================================
// Workflow Status
// ============================================

export const WORKFLOW_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const;

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
};

export const WORKFLOW_NODE_TYPES = {
  TRIGGER: 'trigger',
  SEND_MESSAGE: 'send_message',
  SEND_EMAIL: 'send_email',
  MAKE_CALL: 'make_call',
  ADD_TAG: 'add_tag',
  REMOVE_TAG: 'remove_tag',
  UPDATE_LEAD: 'update_lead',
  CREATE_TASK: 'create_task',
  NOTIFY_USER: 'notify_user',
  WEBHOOK: 'webhook',
  AI_AGENT: 'ai_agent',
  CONDITION: 'condition',
  DELAY: 'delay',
  WAIT_FOR_REPLY: 'wait_for_reply',
  SPLIT_PATH: 'split_path',
  END: 'end',
} as const;

export const WORKFLOW_NODE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  send_message: 'Send Message',
  send_email: 'Send Email',
  make_call: 'Make Call',
  add_tag: 'Add Tag',
  remove_tag: 'Remove Tag',
  update_lead: 'Update Lead',
  create_task: 'Create Task',
  notify_user: 'Notify User',
  webhook: 'Webhook',
  ai_agent: 'AI Agent',
  condition: 'Condition',
  delay: 'Delay',
  wait_for_reply: 'Wait for Reply',
  split_path: 'Split Path',
  end: 'End',
};

export const WORKFLOW_NODE_ICONS: Record<string, string> = {
  trigger: 'Zap',
  send_message: 'MessageSquare',
  send_email: 'Mail',
  make_call: 'Phone',
  add_tag: 'Tag',
  remove_tag: 'TagOff',
  update_lead: 'UserCog',
  create_task: 'CheckSquare',
  notify_user: 'Bell',
  webhook: 'Webhook',
  ai_agent: 'Bot',
  condition: 'GitBranch',
  delay: 'Clock',
  wait_for_reply: 'MessageCircle',
  split_path: 'Split',
  end: 'Flag',
};

export const WORKFLOW_TRIGGER_TYPES = {
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  TAG_ADDED: 'tag_added',
  TAG_REMOVED: 'tag_removed',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_STARTED: 'conversation_started',
  CONVERSATION_CLOSED: 'conversation_closed',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  FORM_SUBMITTED: 'form_submitted',
  WEBHOOK_CALLED: 'webhook_called',
  SCHEDULE: 'schedule',
  API_CALL: 'api_call',
} as const;

export const WORKFLOW_TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Lead Created',
  lead_updated: 'Lead Updated',
  tag_added: 'Tag Added',
  tag_removed: 'Tag Removed',
  message_received: 'Message Received',
  message_sent: 'Message Sent',
  conversation_started: 'Conversation Started',
  conversation_closed: 'Conversation Closed',
  campaign_completed: 'Campaign Completed',
  form_submitted: 'Form Submitted',
  webhook_called: 'Webhook Called',
  schedule: 'Schedule',
  api_call: 'API Call',
};

// ============================================
// Message Status
// ============================================

export const MESSAGE_STATUSES = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const MESSAGE_STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  queued: '#3B82F6',
  sending: '#8B5CF6',
  sent: '#6366F1',
  delivered: '#10B981',
  read: '#059669',
  failed: '#EF4444',
  cancelled: '#9CA3AF',
};

// ============================================
// Call Status
// ============================================

export const CALL_STATUSES = {
  QUEUED: 'queued',
  INITIATED: 'initiated',
  RINGING: 'ringing',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BUSY: 'busy',
  FAILED: 'failed',
  NO_ANSWER: 'no_answer',
  CANCELLED: 'cancelled',
} as const;

export const CALL_STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  initiated: 'Initiated',
  ringing: 'Ringing',
  in_progress: 'In Progress',
  completed: 'Completed',
  busy: 'Busy',
  failed: 'Failed',
  no_answer: 'No Answer',
  cancelled: 'Cancelled',
};

// ============================================
// Task Priority
// ============================================

export const TASK_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

// ============================================
// Webhook Events
// ============================================

export const WEBHOOK_EVENTS = {
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_DELETED: 'lead.deleted',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read',
  CONVERSATION_STARTED: 'conversation.started',
  CONVERSATION_CLOSED: 'conversation.closed',
  CAMPAIGN_STARTED: 'campaign.started',
  CAMPAIGN_COMPLETED: 'campaign.completed',
  WORKFLOW_EXECUTED: 'workflow.executed',
  CALL_COMPLETED: 'call.completed',
  FORM_SUBMITTED: 'form.submitted',
} as const;

export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'lead.deleted': 'Lead Deleted',
  'message.received': 'Message Received',
  'message.sent': 'Message Sent',
  'message.delivered': 'Message Delivered',
  'message.read': 'Message Read',
  'conversation.started': 'Conversation Started',
  'conversation.closed': 'Conversation Closed',
  'campaign.started': 'Campaign Started',
  'campaign.completed': 'Campaign Completed',
  'workflow.executed': 'Workflow Executed',
  'call.completed': 'Call Completed',
  'form.submitted': 'Form Submitted',
};

// ============================================
// Pagination
// ============================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ============================================
// Rate Limits
// ============================================

export const RATE_LIMITS = {
  AUTH: {
    LOGIN: { limit: 5, window: 300 }, // 5 attempts per 5 minutes
    REGISTER: { limit: 3, window: 3600 }, // 3 attempts per hour
    FORGOT_PASSWORD: { limit: 3, window: 3600 },
  },
  API: {
    DEFAULT: { limit: 1000, window: 3600 }, // 1000 requests per hour
    PUBLIC: { limit: 100, window: 3600 },
    WEBHOOK: { limit: 10000, window: 3600 },
  },
  MESSAGES: {
    WHATSAPP: { limit: 1000, window: 86400 }, // per day
    SMS: { limit: 500, window: 86400 },
    EMAIL: { limit: 5000, window: 86400 },
    TELEGRAM: { limit: 1000, window: 86400 },
  },
} as const;

// ============================================
// AI Configuration
// ============================================

export const AI_MODELS = {
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
} as const;

export const AI_VOICES = {
  ALLOY: 'alloy',
  ECHO: 'echo',
  FABLE: 'fable',
  ONYX: 'onyx',
  NOVA: 'nova',
  SHIMMER: 'shimmer',
} as const;

export const AI_INTENTS = {
  GREETING: 'greeting',
  INQUIRY: 'inquiry',
  PRICING: 'pricing',
  SUPPORT: 'support',
  COMPLAINT: 'complaint',
  FEEDBACK: 'feedback',
  UNSUBSCRIBE: 'unsubscribe',
  BOOKING: 'booking',
  PURCHASE: 'purchase',
  GENERAL: 'general',
} as const;

// ============================================
// Date & Time
// ============================================

export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  ISO: 'YYYY-MM-DD',
  ISO_WITH_TIME: 'YYYY-MM-DD HH:mm:ss',
} as const;

export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

// ============================================
// File Upload
// ============================================

export const MAX_FILE_SIZE = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  AUDIO: 10 * 1024 * 1024, // 10MB
  CSV: 5 * 1024 * 1024, // 5MB
} as const;

export const ALLOWED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/webm'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  CSV: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const;

// ============================================
// Reputation Scores
// ============================================

export const REPUTATION_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  FAIR: 50,
  POOR: 30,
  CRITICAL: 0,
} as const;

export const REPUTATION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

export const REPUTATION_COLORS: Record<string, string> = {
  excellent: '#10B981',
  good: '#3B82F6',
  fair: '#F59E0B',
  poor: '#EF4444',
  critical: '#DC2626',
};

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  // Permission
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  REQUIRED_FIELD: 'REQUIRED_FIELD',

  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  WHATSAPP_ERROR: 'WHATSAPP_ERROR',
  SMS_ERROR: 'SMS_ERROR',
  EMAIL_ERROR: 'EMAIL_ERROR',
  VOICE_ERROR: 'VOICE_ERROR',
  AI_ERROR: 'AI_ERROR',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
} as const;

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'beecastly_auth_token',
  REFRESH_TOKEN: 'beecastly_refresh_token',
  USER: 'beecastly_user',
  TENANT: 'beecastly_tenant',
  THEME: 'beecastly_theme',
  SIDEBAR_COLLAPSED: 'beecastly_sidebar_collapsed',
  NOTIFICATIONS: 'beecastly_notifications',
  RECENT_SEARCHES: 'beecastly_recent_searches',
} as const;

// ============================================
// Theme
// ============================================

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// ============================================
// Notification Types
// ============================================

export const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  LEAD: 'lead',
  TASK: 'task',
  CAMPAIGN: 'campaign',
  WORKFLOW: 'workflow',
  SYSTEM: 'system',
} as const;

// ============================================
// Currency
// ============================================

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
} as const;

// ============================================
// Languages
// ============================================

export const LANGUAGES = {
  EN: { code: 'en', name: 'English', flag: '🇺🇸' },
  ES: { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  FR: { code: 'fr', name: 'French', flag: '🇫🇷' },
  DE: { code: 'de', name: 'German', flag: '🇩🇪' },
  IT: { code: 'it', name: 'Italian', flag: '🇮🇹' },
  PT: { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  HI: { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  AR: { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  ZH: { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  JA: { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
} as const;
