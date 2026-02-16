// ============================================
// Workflow Engine Service
// Execute automation workflows
// ============================================

import { Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';
import { queueLogger } from '../../utils/logger.js';

export class WorkflowEngine {
  private worker: Worker | null = null;

  constructor(private app: FastifyInstance) {}

  async initialize(): Promise<void> {
    this.worker = new Worker(
      'workflows',
      async (job: Job) => {
        const { workflowId, tenantId, leadId, triggerData } = job.data;

        queueLogger.debug({ workflowId, leadId }, 'Executing workflow');

        try {
          // Get workflow definition
          const workflow = await this.app.db.queryOne(
            'SELECT nodes, edges FROM workflows WHERE id = $1 AND tenant_id = $2',
            [workflowId, tenantId]
          );

          if (!workflow) {
            throw new Error('Workflow not found');
          }

          const nodes = JSON.parse(workflow.nodes);
          const edges = JSON.parse(workflow.edges);

          // Create execution record
          const execution = await this.app.db.insert('workflow_executions', {
            workflow_id: workflowId,
            tenant_id: tenantId,
            lead_id: leadId,
            status: 'running',
            context: JSON.stringify(triggerData || {}),
            node_results: JSON.stringify([]),
          });

          // Execute workflow nodes
          const results = await this.executeNodes(nodes, edges, execution.id, tenantId, leadId, triggerData);

          // Update execution record
          await this.app.db.query(
            "UPDATE workflow_executions SET status = 'completed', completed_at = NOW(), node_results = $1 WHERE id = $2",
            [JSON.stringify(results), execution.id]
          );

          return { executionId: execution.id, results };
        } catch (error) {
          queueLogger.error({ error, workflowId }, 'Workflow execution failed');
          throw error;
        }
      },
      { concurrency: config.queue.concurrency.workflows }
    );

    this.worker.on('completed', (job) => {
      queueLogger.debug({ jobId: job.id }, 'Workflow job completed');
    });

    this.worker.on('failed', (job, error) => {
      queueLogger.error({ jobId: job?.id, error }, 'Workflow job failed');
    });

    queueLogger.info('Workflow engine initialized');
  }

  private async executeNodes(
    nodes: any[],
    edges: any[],
    executionId: string,
    tenantId: string,
    leadId: string,
    context: any
  ): Promise<any[]> {
    const results: any[] = [];
    const executedNodes = new Set<string>();

    // Find trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('No trigger node found');
    }

    // BFS execution
    const queue: string[] = [triggerNode.id];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (executedNodes.has(nodeId)) continue;

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // Execute node
      const result = await this.executeNode(node, tenantId, leadId, context);
      results.push({ nodeId, result });
      executedNodes.add(nodeId);

      // Find next nodes
      const outgoingEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        // Check condition if present
        if (edge.condition) {
          const conditionMet = this.evaluateCondition(edge.condition, result);
          if (!conditionMet) continue;
        }
        queue.push(edge.target);
      }
    }

    return results;
  }

  private async executeNode(
    node: any,
    tenantId: string,
    leadId: string,
    context: any
  ): Promise<any> {
    queueLogger.debug({ nodeType: node.type, nodeId: node.id }, 'Executing node');

    switch (node.type) {
      case 'trigger':
        return { triggered: true };

      case 'send_message':
        // Queue message
        await this.app.addJob('messages', 'send-message', {
          tenantId,
          leadId,
          channel: node.data.channel,
          content: node.data.content,
        });
        return { sent: true };

      case 'send_email':
        await this.app.addJob('messages', 'send-message', {
          tenantId,
          leadId,
          channel: 'email',
          content: node.data.content,
          subject: node.data.subject,
        });
        return { sent: true };

      case 'add_tag':
        await this.app.db.query(
          'UPDATE leads SET tags = array_append(tags, $1) WHERE id = $2 AND tenant_id = $3',
          [node.data.tag, leadId, tenantId]
        );
        return { tagged: true };

      case 'remove_tag':
        await this.app.db.query(
          'UPDATE leads SET tags = array_remove(tags, $1) WHERE id = $2 AND tenant_id = $3',
          [node.data.tag, leadId, tenantId]
        );
        return { untagged: true };

      case 'update_lead':
        await this.app.db.update('leads', leadId, node.data.updates);
        return { updated: true };

      case 'create_task':
        await this.app.db.insert('tasks', {
          tenant_id: tenantId,
          title: node.data.title,
          description: node.data.description,
          assigned_to: node.data.assignedTo,
          lead_id: leadId,
          priority: node.data.priority || 'medium',
        });
        return { created: true };

      case 'delay':
        // Delay is handled by job scheduling
        await new Promise((resolve) => setTimeout(resolve, node.data.delayMs || 1000));
        return { delayed: true };

      case 'condition':
        return { condition: node.data.condition };

      case 'webhook':
        await this.app.addJob('messages', 'send-webhook', {
          tenantId,
          url: node.data.url,
          payload: { leadId, context },
        });
        return { webhookSent: true };

      case 'ai_agent':
        // Trigger AI conversation
        return { aiTriggered: true };

      case 'end':
        return { ended: true };

      default:
        return { unknown: true };
    }
  }

  private evaluateCondition(condition: string, result: any): boolean {
    try {
      // Simple condition evaluation
      // In production, use a proper expression evaluator
      return true;
    } catch {
      return false;
    }
  }

  async execute(workflowId: string, data: any): Promise<any> {
    // Add to queue for execution
    const job = await this.app.addJob('workflows', 'execute-workflow', {
      workflowId,
      ...data,
    });

    return { jobId: job.id, status: 'queued' };
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    queueLogger.info('Workflow engine closed');
  }
}
