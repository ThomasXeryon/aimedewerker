import { Agent, TaskExecution, InsertTaskExecution } from "@shared/schema";
import { storage } from "./storage";
import { aiService } from "./ai-service";

interface QueuedTask {
  agentId: number;
  organizationId: number;
  priority: string;
  manualTrigger?: boolean;
  scheduledFor?: Date;
}

class TaskQueue {
  private queue: QueuedTask[] = [];
  private processing = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    // Start the task processor
    this.startProcessor();
    
    // Check for scheduled tasks every minute
    this.intervalId = setInterval(() => {
      this.checkScheduledTasks();
    }, 60000);
  }

  async addTask(task: QueuedTask): Promise<TaskExecution> {
    // Create task execution record
    const execution = await storage.createTaskExecution({
      agentId: task.agentId,
      organizationId: task.organizationId,
      status: 'pending',
    });

    // Add to queue
    this.queue.push({
      ...task,
      executionId: execution.id,
    } as any);

    // Sort queue by priority
    this.sortQueue();

    console.log(`Task added to queue: Agent ${task.agentId}, Execution ${execution.id}`);
    return execution;
  }

  private sortQueue(): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    
    this.queue.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
      return aPriority - bPriority;
    });
  }

  private async startProcessor(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.processing) {
      try {
        const task = this.queue.shift();
        
        if (task) {
          await this.processTask(task);
        } else {
          // Wait a bit before checking for more tasks
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error('Error processing task:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processTask(task: QueuedTask & { executionId?: number }): Promise<void> {
    if (!task.executionId) return;

    try {
      console.log(`Processing task: Agent ${task.agentId}, Execution ${task.executionId}`);
      
      // Check organization quota before executing
      const organization = await storage.getOrganization(task.organizationId);
      if (organization && organization.apiUsed >= organization.apiQuota) {
        await storage.updateTaskExecution(task.executionId, {
          status: 'failed',
          error: 'Organization API quota exceeded',
          endTime: new Date(),
        });
        return;
      }

      // Execute the agent
      await aiService.executeAgent(task.agentId, task.executionId);

      // Update organization API usage
      if (organization) {
        await storage.updateOrganizationUsage(
          task.organizationId, 
          organization.apiUsed + 1
        );
      }

      // Update usage tracking
      await storage.createOrUpdateUsage({
        organizationId: task.organizationId,
        apiCalls: 1,
        browserSessions: 1,
        storageUsed: 0,
      });

      console.log(`Task completed: Agent ${task.agentId}, Execution ${task.executionId}`);

    } catch (error) {
      console.error(`Task failed: Agent ${task.agentId}, Execution ${task.executionId}:`, error);
      
      if (task.executionId) {
        await storage.updateTaskExecution(task.executionId, {
          status: 'failed',
          error: error.message,
          endTime: new Date(),
        });
      }
    }
  }

  private async checkScheduledTasks(): Promise<void> {
    try {
      // Get all active agents and check their schedules
      const organizations = await storage.getOrganization(1); // This would need to be improved for multi-org
      
      // In a real implementation, you'd iterate through all organizations
      // and check their agents' schedules
      
      console.log('Checking scheduled tasks...');
      
      // This is a simplified implementation
      // In production, you'd want to track last execution times
      // and check against agent schedules properly
      
    } catch (error) {
      console.error('Error checking scheduled tasks:', error);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getQueueStatus(): { pending: number; priorityCounts: Record<string, number> } {
    const priorityCounts = this.queue.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      pending: this.queue.length,
      priorityCounts,
    };
  }

  stop(): void {
    this.processing = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export const taskQueue = new TaskQueue();
