// ============================================
// AI Plugin
// OpenAI integration for lead qualification,
// conversation, and voice
// ============================================

import fp from 'fastify-plugin';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { aiLogger } from '../utils/logger.js';

// OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Generate AI response
export async function generateResponse(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  } = {}
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || config.openai.model,
      messages,
      max_tokens: options.maxTokens || config.openai.maxTokens,
      temperature: options.temperature || config.openai.temperature,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    const content = response.choices[0]?.message?.content || '';
    aiLogger.debug({ model: options.model, tokens: response.usage?.total_tokens }, 'AI response generated');
    return content;
  } catch (error) {
    aiLogger.error({ error }, 'Failed to generate AI response');
    throw error;
  }
}

// Generate embedding
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    aiLogger.error({ error }, 'Failed to generate embedding');
    throw error;
  }
}

// Detect intent
export async function detectIntent(
  message: string,
  context?: string
): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, any>;
}> {
  try {
    const systemPrompt = `You are an intent detection system. Analyze the user message and identify:
1. The primary intent (greeting, inquiry, pricing, support, complaint, feedback, unsubscribe, booking, purchase, general)
2. Confidence score (0-1)
3. Key entities mentioned (names, dates, products, etc.)

Respond in JSON format:
{
  "intent": "string",
  "confidence": number,
  "entities": {}
}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (context) {
      messages.push({ role: 'system', content: `Context: ${context}` });
    }

    messages.push({ role: 'user', content: message });

    const response = await generateResponse(messages, {
      maxTokens: 500,
      temperature: 0.3,
      jsonMode: true,
    });

    return JSON.parse(response);
  } catch (error) {
    aiLogger.error({ error, message }, 'Intent detection failed');
    return { intent: 'general', confidence: 0.5, entities: {} };
  }
}

// Analyze sentiment
export async function analyzeSentiment(
  text: string
): Promise<'positive' | 'neutral' | 'negative'> {
  try {
    const systemPrompt = `Analyze the sentiment of the following text. Respond with only one word: "positive", "neutral", or "negative".`;

    const response = await generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      { maxTokens: 10, temperature: 0.1 }
    );

    const sentiment = response.toLowerCase().trim();
    if (sentiment.includes('positive')) return 'positive';
    if (sentiment.includes('negative')) return 'negative';
    return 'neutral';
  } catch (error) {
    aiLogger.error({ error, text }, 'Sentiment analysis failed');
    return 'neutral';
  }
}

// Summarize conversation
export async function summarizeConversation(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const conversation = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const systemPrompt = `Summarize the following conversation in 2-3 sentences. Focus on key points, decisions made, and action items.`;

    return await generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversation },
      ],
      { maxTokens: 200, temperature: 0.5 }
    );
  } catch (error) {
    aiLogger.error({ error }, 'Conversation summarization failed');
    return '';
  }
}

// Extract entities
export async function extractEntities(
  text: string
): Promise<Record<string, any>> {
  try {
    const systemPrompt = `Extract key entities from the text including: names, emails, phone numbers, dates, locations, products, amounts, and any other relevant information.

Respond in JSON format with extracted entities.`;

    const response = await generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      { maxTokens: 500, temperature: 0.3, jsonMode: true }
    );

    return JSON.parse(response);
  } catch (error) {
    aiLogger.error({ error, text }, 'Entity extraction failed');
    return {};
  }
}

// Qualify lead
export async function qualifyLead(
  leadData: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    messages?: string[];
    customFields?: Record<string, any>;
  }
): Promise<{
  score: number;
  intent: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category?: string;
  summary?: string;
  nextBestAction?: string;
}> {
  try {
    const systemPrompt = `You are a lead qualification expert. Analyze the lead data and provide:
1. Qualification score (0-100)
2. Detected intent
3. Sentiment (positive/neutral/negative)
4. Lead category (if identifiable)
5. Brief summary
6. Next best action recommendation

Respond in JSON format:
{
  "score": number,
  "intent": "string",
  "sentiment": "positive|neutral|negative",
  "category": "string",
  "summary": "string",
  "nextBestAction": "string"
}`;

    const userPrompt = JSON.stringify(leadData, null, 2);

    const response = await generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 800, temperature: 0.4, jsonMode: true }
    );

    return JSON.parse(response);
  } catch (error) {
    aiLogger.error({ error, leadData }, 'Lead qualification failed');
    return {
      score: 50,
      intent: 'general',
      sentiment: 'neutral',
      summary: '',
      nextBestAction: '',
    };
  }
}

// Generate call script
export async function generateCallScript(
  leadInfo: Record<string, any>,
  purpose: string,
  talkingPoints: string[]
): Promise<{
  greeting: string;
  script: string;
  questions: string[];
  objections: Record<string, string>;
  closing: string;
}> {
  try {
    const systemPrompt = `You are an expert sales call script writer. Create a natural, conversational call script based on the lead information and purpose provided.

The script should include:
1. A personalized greeting
2. Main talking points woven into natural dialogue
3. Key qualifying questions
4. Common objection handlers
5. A strong closing statement

Respond in JSON format:
{
  "greeting": "string",
  "script": "string (full conversation flow)",
  "questions": ["string"],
  "objections": {"objection": "response"},
  "closing": "string"
}`;

    const userPrompt = `Lead Info: ${JSON.stringify(leadInfo, null, 2)}
Purpose: ${purpose}
Talking Points: ${talkingPoints.join(', ')}`;

    const response = await generateResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 1500, temperature: 0.7, jsonMode: true }
    );

    return JSON.parse(response);
  } catch (error) {
    aiLogger.error({ error, leadInfo }, 'Call script generation failed');
    return {
      greeting: `Hello, this is a call from our company.`,
      script: '',
      questions: [],
      objections: {},
      closing: 'Thank you for your time. Have a great day!',
    };
  }
}

// Generate AI conversation response
export async function generateConversationResponse(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  leadInfo: Record<string, any>,
  goal?: string
): Promise<{
  response: string;
  intent?: string;
  shouldHandoff: boolean;
  handoffReason?: string;
}> {
  try {
    const systemPrompt = `You are a helpful AI assistant for a sales and marketing automation platform. Your goal is to engage leads naturally and help them with their inquiries.

Guidelines:
- Be friendly, professional, and concise
- Ask clarifying questions when needed
- Don't make up information you don't have
- If the user asks for human assistance or becomes frustrated, indicate handoff is needed
- Stay focused on the conversation goal

${goal ? `Current Goal: ${goal}` : ''}

Lead Info: ${JSON.stringify(leadInfo, null, 2)}

Respond in JSON format:
{
  "response": "string (your reply to the user)",
  "intent": "string (detected user intent)",
  "shouldHandoff": boolean,
  "handoffReason": "string (if shouldHandoff is true)"
}`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await generateResponse(messages, {
      maxTokens: 500,
      temperature: 0.7,
      jsonMode: true,
    });

    return JSON.parse(response);
  } catch (error) {
    aiLogger.error({ error }, 'Conversation response generation failed');
    return {
      response: "I apologize, but I'm having trouble processing your request. Let me connect you with a team member who can help.",
      shouldHandoff: true,
      handoffReason: 'AI error',
    };
  }
}

// AI plugin
export const aiPlugin = fp(async (fastify) => {
  if (!config.openai.apiKey) {
    aiLogger.warn('OpenAI API key not configured. AI features will be disabled.');
  } else {
    aiLogger.info('AI plugin registered');
  }

  // Decorate fastify with AI helpers
  fastify.decorate('ai', {
    generateResponse,
    generateEmbedding,
    detectIntent,
    analyzeSentiment,
    summarizeConversation,
    extractEntities,
    qualifyLead,
    generateCallScript,
    generateConversationResponse,
    client: openai,
  });
});

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    ai: {
      generateResponse: typeof generateResponse;
      generateEmbedding: typeof generateEmbedding;
      detectIntent: typeof detectIntent;
      analyzeSentiment: typeof analyzeSentiment;
      summarizeConversation: typeof summarizeConversation;
      extractEntities: typeof extractEntities;
      qualifyLead: typeof qualifyLead;
      generateCallScript: typeof generateCallScript;
      generateConversationResponse: typeof generateConversationResponse;
      client: OpenAI;
    };
  }
}
