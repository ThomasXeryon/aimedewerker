import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { aiService } from "./ai-service";
import { taskQueue } from "./task-queue";
import { insertAgentSchema, insertTaskExecutionSchema } from "@shared/schema";
import { z } from "zod";

// Middleware to check organization access
async function checkOrganizationAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }

  const user = req.user;
  const organizationId = parseInt(req.params.organizationId || req.body.organizationId);
  
  if (organizationId && user.organizationId !== organizationId) {
    return res.sendStatus(403);
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Organization routes
  app.get("/api/organization", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const organization = await storage.getOrganization(req.user.organizationId);
    if (!organization) return res.sendStatus(404);
    
    res.json(organization);
  });

  // Agent routes
  app.get("/api/agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agents = await storage.getAgentsByOrganization(req.user.organizationId);
    res.json(agents);
  });

  app.post("/api/agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const validatedData = insertAgentSchema.parse({
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      });
      
      const agent = await storage.createAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/agents/:id", checkOrganizationAccess, async (req, res) => {
    const agent = await storage.getAgent(parseInt(req.params.id));
    if (!agent || agent.organizationId !== req.user!.organizationId) {
      return res.sendStatus(404);
    }
    res.json(agent);
  });

  app.put("/api/agents/:id", checkOrganizationAccess, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const agent = await storage.getAgent(agentId);
    
    if (!agent || agent.organizationId !== req.user!.organizationId) {
      return res.sendStatus(404);
    }
    
    const updatedAgent = await storage.updateAgent(agentId, req.body);
    res.json(updatedAgent);
  });

  app.delete("/api/agents/:id", checkOrganizationAccess, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const agent = await storage.getAgent(agentId);
    
    if (!agent || agent.organizationId !== req.user!.organizationId) {
      return res.sendStatus(404);
    }
    
    const deleted = await storage.deleteAgent(agentId);
    res.json({ success: deleted });
  });

  // Execute agent manually
  app.post("/api/agents/:id/execute", checkOrganizationAccess, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const agent = await storage.getAgent(agentId);
    
    if (!agent || agent.organizationId !== req.user!.organizationId) {
      return res.sendStatus(404);
    }
    
    try {
      const execution = await taskQueue.addTask({
        agentId,
        organizationId: req.user!.organizationId,
        priority: agent.priority,
        manualTrigger: true,
      });
      
      res.json({ executionId: execution.id });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Task execution routes
  app.get("/api/executions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = await storage.getTaskExecutionsByOrganization(req.user.organizationId, limit);
    res.json(executions);
  });

  app.get("/api/agents/:id/executions", checkOrganizationAccess, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    
    const executions = await storage.getTaskExecutionsByAgent(agentId, limit);
    res.json(executions);
  });

  app.get("/api/executions/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const execution = await storage.getTaskExecution(parseInt(req.params.id));
    if (!execution || execution.organizationId !== req.user.organizationId) {
      return res.sendStatus(404);
    }
    
    res.json(execution);
  });

  // Usage and analytics routes
  app.get("/api/usage", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const usage = await storage.getUsageByOrganization(req.user.organizationId);
    const organization = await storage.getOrganization(req.user.organizationId);
    
    res.json({
      usage: usage || {
        apiCalls: 0,
        browserSessions: 0,
        storageUsed: 0,
      },
      quota: {
        apiCalls: organization?.apiQuota || 1000,
        apiUsed: organization?.apiUsed || 0,
      },
    });
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const agents = await storage.getAgentsByOrganization(req.user.organizationId);
    const executions = await storage.getTaskExecutionsByOrganization(req.user.organizationId, 100);
    const usage = await storage.getUsageByOrganization(req.user.organizationId);
    
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const completedTasks = executions.filter(e => e.status === 'completed').length;
    const totalTasks = executions.length;
    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    res.json({
      activeAgents,
      completedTasks,
      successRate: Math.round(successRate * 10) / 10,
      apiCalls: usage?.apiCalls || 0,
      recentExecutions: executions.slice(0, 10),
    });
  });

  // Start agent execution
  app.post("/api/agents/:id/execute", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent || agent.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Create new task execution
      const execution = await storage.createTaskExecution({
        agentId: agentId,
        status: 'pending',
        organizationId: req.user.organizationId
      });

      // Start execution in background
      const { aiService } = await import('./ai-service');
      aiService.executeAgent(agentId, execution.id).catch(error => {
        console.error('Agent execution failed:', error);
        storage.updateTaskExecution(execution.id, {
          status: 'failed',
          endTime: new Date(),
          error: error.message
        });
      });

      res.json(execution);
    } catch (error) {
      console.error('Error starting execution:', error);
      res.status(500).json({ message: "Failed to start execution" });
    }
  });

  // Stop execution
  app.post("/api/executions/:id/stop", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const executionId = parseInt(req.params.id);
      const execution = await storage.getTaskExecution(executionId);
      
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }

      const agent = await storage.getAgent(execution.agentId);
      if (!agent || agent.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { aiService } = await import('./ai-service');
      await aiService.stopExecution(executionId);

      res.json({ message: "Execution stopped" });
    } catch (error) {
      console.error('Error stopping execution:', error);
      res.status(500).json({ message: "Failed to stop execution" });
    }
  });

  // Pause execution
  app.post("/api/executions/:id/pause", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const executionId = parseInt(req.params.id);
      const execution = await storage.getTaskExecution(executionId);
      
      if (!execution) {
        return res.status(404).json({ message: "Execution not found" });
      }

      const agent = await storage.getAgent(execution.agentId);
      if (!agent || agent.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateTaskExecution(executionId, {
        status: 'paused'
      });

      res.json({ message: "Execution paused" });
    } catch (error) {
      console.error('Error pausing execution:', error);
      res.status(500).json({ message: "Failed to pause execution" });
    }
  });

  const httpServer = createServer(app);

  // Simple event stream for real-time updates
  app.get('/api/events/:agentId', checkOrganizationAccess, (req, res) => {
    const agentId = parseInt(req.params.agentId);
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write('data: {"type":"connected","agentId":' + agentId + '}\n\n');

    // Store the response object for this agent
    if (!global.eventStreams) {
      global.eventStreams = new Map();
    }
    global.eventStreams.set(agentId, res);

    // Send demo data immediately to show the system working
    let step = 0;
    const demoUpdates = [
      { type: 'agent_action', action: { type: 'navigate', url: 'https://httpbin.org/forms/post' } },
      { type: 'agent_screenshot', screenshot: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIALoAugMBEQACEQEDEQH/xAAbAAEAAwEBAQEAAAAAAAAAAAAAAQIDBAUGB//EADYQAAIBAwIEAwcDBAMBAAAAAAECAAMEESEFEjFBUWFxgRMikaGxwdEGMuEUQlLwI2Lx8f/EABkBAQADAQEAAAAAAAAAAAAAAAABAgMEBf/EACgRAQEAAgIBBAEDBQEAAAAAAAABAhEDEiExBEFRYSJxkROBobHwMf/aAAwDAQACEQMRAD8A+iiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiB' },
      { type: 'agent_action', action: { type: 'type', x: 150, y: 200, text: 'AgentScale Demo' } },
      { type: 'agent_action', action: { type: 'click', x: 200, y: 300, button: 'left' } }
    ];

    const sendUpdate = () => {
      if (step < demoUpdates.length) {
        const update = demoUpdates[step];
        res.write(`data: ${JSON.stringify(update)}\n\n`);
        step++;
        setTimeout(sendUpdate, 2000);
      }
    };

    setTimeout(sendUpdate, 1000);

    req.on('close', () => {
      if (global.eventStreams) {
        global.eventStreams.delete(agentId);
      }
    });
  });

  return httpServer;
}
