// ============================================
// Queue Plugin
// BullMQ Redis queues for background jobs
// ============================================

import fp from 'fastify-plugin';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/index.js';
import { queueLogger } from '../utils/logger.js';

// Redis connection
const redisConnection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  enableReadyCheck: config.redis.enableReadyCheck,
});

// Queue definitions
export const queues = {
  messages: new Queue('messages', { connection: redisConnection }),
  workflows: new Queue('workflows', { connection: redisConnection }),
  voice: new Queue('voice', { connection: redisConnection }),
  analytics: new Queue('analytics', { connection: redisConnection }),
  exports: new Queue('exports', { connection: redisConnection }),
  imports: new Queue('imports', { connection: redisConnection }),
  ai: new Queue('ai', { connection: redisConnection }),
};

// Default job options
const defaultJobOptions = config.queue.defaultJobOptions;

// Add job to queue
export async function addJob<T = any>(
  queueName: keyof typeof queues,
  jobName: string,
  data: T,
  options: any = {}
): Promise<Job<T>> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const job = await queue.add(jobName, data, {
    ...defaultJobOptions,
    ...options,
  });

  queueLogger.debug({ queue: queueName, jobId: job.id, jobName }, 'Job added to queue');
  return job;
}

// Add bulk jobs
export async function addBulkJobs<T = any>(
  queueName: keyof typeof queues,
  jobs: Array<{ name: string; data: T; opts?: any }>
): Promise<Job<T>[]> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const result = await queue.addBulk(
    jobs.map((j) => ({
      name: j.name,
      data: j.data,
      opts: { ...defaultJobOptions, ...j.opts },
    }))
  );

  queueLogger.debug({ queue: queueName, count: jobs.length }, 'Bulk jobs added to queue');
  return result;
}

// Get job status
export async function getJobStatus(
  queueName: keyof typeof queues,
  jobId: string
): Promise<any> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = await job.progress;

  return {
    id: job.id,
    name: job.name,
    state,
    progress,
    data: job.data,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

// Queue metrics
export async function getQueueMetrics(queueName: keyof typeof queues): Promise<any> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

// Clean completed jobs
export async function cleanQueue(
  queueName: keyof typeof queues,
  gracePeriodMs: number = 24 * 60 * 60 * 1000
): Promise<void> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  await queue.clean(gracePeriodMs, 1000, 'completed');
  await queue.clean(gracePeriodMs, 1000, 'failed');

  queueLogger.info({ queue: queueName }, 'Queue cleaned');
}

// Pause queue
export async function pauseQueue(queueName: keyof typeof queues): Promise<void> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  await queue.pause();
  queueLogger.info({ queue: queueName }, 'Queue paused');
}

// Resume queue
export async function resumeQueue(queueName: keyof typeof queues): Promise<void> {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  await queue.resume();
  queueLogger.info({ queue: queueName }, 'Queue resumed');
}

// Queue plugin
export const queuePlugin = fp(async (fastify) => {
  // Test Redis connection
  try {
    await redisConnection.ping();
    queueLogger.info('Redis connected successfully');
  } catch (error) {
    queueLogger.error({ error }, 'Failed to connect to Redis');
    throw error;
  }

  // Decorate fastify with queue helpers
  fastify.decorate('queues', queues);
  fastify.decorate('addJob', addJob);
  fastify.decorate('addBulkJobs', addBulkJobs);
  fastify.decorate('getJobStatus', getJobStatus);
  fastify.decorate('getQueueMetrics', getQueueMetrics);
  fastify.decorate('cleanQueue', cleanQueue);
  fastify.decorate('pauseQueue', pauseQueue);
  fastify.decorate('resumeQueue', resumeQueue);

  queueLogger.info('Queue plugin registered');
});

// Close all queues and Redis connection
export async function closeQueues(): Promise<void> {
  for (const [name, queue] of Object.entries(queues)) {
    await queue.close();
    queueLogger.debug({ queue: name }, 'Queue closed');
  }
  await redisConnection.quit();
  queueLogger.info('All queues closed');
}

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    queues: typeof queues;
    addJob: typeof addJob;
    addBulkJobs: typeof addBulkJobs;
    getJobStatus: typeof getJobStatus;
    getQueueMetrics: typeof getQueueMetrics;
    cleanQueue: typeof cleanQueue;
    pauseQueue: typeof pauseQueue;
    resumeQueue: typeof resumeQueue;
  }
}
