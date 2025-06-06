import OpenAI from "openai";
import { chromium } from "playwright";
import { Agent, TaskExecution } from "@shared/schema";
import { storage } from "./storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "your-api-key"
});

interface ComputerAction {
  type: string;
  x?: number;
  y?: number;
  button?: string;
  text?: string;
  keys?: string[];
  scroll_x?: number;
  scroll_y?: number;
}

interface ExecutionContext {
  agent: Agent;
  execution: TaskExecution;
  page: any; // Playwright page
  screenshots: string[];
  actions: ComputerAction[];
}

class AIService {
  private executionContexts: Map<number, ExecutionContext> = new Map();

  async executeAgent(agentId: number, executionId: number): Promise<void> {
    const agent = await storage.getAgent(agentId);
    const execution = await storage.getTaskExecution(executionId);

    if (!agent || !execution) {
      throw new Error('Agent or execution not found');
    }

    // Update execution status to running
    await storage.updateTaskExecution(executionId, {
      status: 'running',
      startTime: new Date(),
    });

    try {
      const context = await this.createExecutionContext(agent, execution);
      this.executionContexts.set(executionId, context);

      await this.runComputerUseLoop(context);

      // Mark execution as completed
      await storage.updateTaskExecution(executionId, {
        status: 'completed',
        endTime: new Date(),
        result: {
          screenshots: context.screenshots,
          actions: context.actions,
          summary: 'Task completed successfully',
        },
      });

    } catch (error) {
      console.error('Agent execution failed:', error);
      
      await storage.updateTaskExecution(executionId, {
        status: 'failed',
        endTime: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await this.cleanupExecutionContext(executionId);
    }
  }

  private async createExecutionContext(agent: Agent, execution: TaskExecution): Promise<ExecutionContext> {
    const browser = await chromium.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
    });

    const page = await browser.newPage({
      viewport: { width: 1024, height: 768 },
    });

    // Navigate to target website if specified, otherwise start with a demo page
    const targetUrl = agent.targetWebsite || 'https://example.com';
    await page.goto(targetUrl);

    const context: ExecutionContext = {
      agent,
      execution,
      page,
      screenshots: [],
      actions: [],
    };

    return context;
  }

  private async runComputerUseLoop(context: ExecutionContext): Promise<void> {
    const { agent, page } = context;
    let maxIterations = 20; // Prevent infinite loops
    let iteration = 0;

    // Take initial screenshot
    let screenshot = await this.takeScreenshot(page);
    context.screenshots.push(screenshot);

    try {
      // Use OpenAI Computer Use API with direct fetch
      const computerUseResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'api-version': 'preview'
        },
        body: JSON.stringify({
          model: "computer-use-preview",
          input: [{
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Complete this task: ${agent.instructions}`
              },
              {
                type: "input_image", 
                image_url: `data:image/png;base64,${screenshot}`
              }
            ]
          }],
          tools: [{
            type: "computer_use_preview",
            display_width: 1024,
            display_height: 768,
            environment: "browser"
          }],
          truncation: "auto"
        })
      });

      if (computerUseResponse.ok) {
        const response = await computerUseResponse.json();
        console.log('Computer Use API response received, model:', response.model);
        await this.processComputerUseResponse(context, response, screenshot);
      } else {
        const errorText = await computerUseResponse.text();
        throw new Error(`Computer Use API error ${computerUseResponse.status}: ${errorText}`);
      }
    } catch (error) {
      console.log('Computer Use API error:', error.message);
      console.log('Falling back to GPT-4o vision processing');
      let response = await this.processTaskWithVision(agent, screenshot);
      await this.processLegacyResponse(context, response, screenshot);
    }
  }



  private async processComputerUseResponse(context: ExecutionContext, response: any, screenshot: string): Promise<void> {
    const { page } = context;
    let iteration = 0;
    const maxIterations = 20;

    while (iteration < maxIterations) {
      iteration++;

      // Check for computer calls in the response
      const computerCalls = response.output.filter((item: any) => item.type === "computer_call");
      
      if (computerCalls.length === 0) {
        console.log('No computer calls found. Task complete.');
        break;
      }

      // Process the first computer call
      const computerCall = computerCalls[0];
      const action = computerCall.action;
      const callId = computerCall.call_id;

      if (!action) {
        console.log('No action in computer call');
        break;
      }

      // Broadcast action to WebSocket clients
      this.broadcastUpdate(context.agent.organizationId, {
        type: 'agent_action',
        agentId: context.agent.id,
        executionId: context.execution.id,
        action: action
      });

      console.log('Executing action:', action);
      await this.executeAction(page, action);
      context.actions.push(action);

      // Take screenshot after action
      screenshot = await this.takeScreenshot(page);
      context.screenshots.push(screenshot);

      // Broadcast screenshot to WebSocket clients
      this.broadcastUpdate(context.agent.organizationId, {
        type: 'agent_screenshot',
        agentId: context.agent.id,
        executionId: context.execution.id,
        screenshot: screenshot
      });

      // Wait briefly between actions
      await page.waitForTimeout(1000);

      // Send screenshot back to continue the loop
      response = await openai.responses.create({
        model: "computer-use-preview",
        previous_response_id: response.id,
        tools: [{
          type: "computer_use_preview",
          display_width: 1024,
          display_height: 768,
          environment: "browser"
        }],
        input: [
          {
            call_id: callId,
            type: "computer_call_output",
            output: {
              type: "computer_screenshot", 
              image_url: `data:image/png;base64,${screenshot}`
            }
          }
        ],
        truncation: "auto"
      });
    }
  }

  private async processLegacyResponse(context: ExecutionContext, response: any, screenshot: string): Promise<void> {
    const { agent, page } = context;
    let iteration = 0;
    const maxIterations = 20;

    while (iteration < maxIterations) {
      iteration++;

      try {
        if (!response.action) {
          console.log('No action in response. Task may be complete.');
          break;
        }

        // Broadcast action to WebSocket clients
        this.broadcastUpdate(context.agent.organizationId, {
          type: 'agent_action',
          agentId: context.agent.id,
          executionId: context.execution.id,
          action: response.action
        });

        console.log('Executing action:', response.action);
        await this.executeAction(page, response.action);
        context.actions.push(response.action);

        // Take screenshot after action
        screenshot = await this.takeScreenshot(page);
        context.screenshots.push(screenshot);

        // Broadcast screenshot to WebSocket clients
        this.broadcastUpdate(context.agent.organizationId, {
          type: 'agent_screenshot',
          agentId: context.agent.id,
          executionId: context.execution.id,
          screenshot: screenshot
        });

        // Wait briefly between actions
        await page.waitForTimeout(1000);

        // Get next action based on new screenshot
        response = await this.processTaskWithVision(agent, screenshot);

      } catch (error) {
        console.error('Error in computer use loop:', error);
        throw error;
      }
    }

    if (iteration >= maxIterations) {
      throw new Error('Maximum iterations reached without task completion');
    }
  }

  private broadcastUpdate(organizationId: number, data: any): void {
    console.log('AI Service broadcasting:', data.type, 'for agent:', data.agentId);
    
    // Send to event stream if available
    if ((global as any).eventStreams && data.agentId) {
      const eventStream = (global as any).eventStreams.get(data.agentId);
      if (eventStream) {
        try {
          eventStream.write(`data: ${JSON.stringify(data)}\n\n`);
          console.log('Sent real-time update for agent:', data.agentId);
        } catch (error) {
          console.error('Error sending event stream update:', error);
        }
      }
    }
  }

  private async processTaskWithVision(agent: Agent, screenshot: string): Promise<{action?: ComputerAction, complete?: boolean}> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert browser automation specialist. Your mission: ${agent.instructions}

            CONTEXT:
            - Agent: ${agent.type}
            - Target: ${agent.targetWebsite || 'web interface'}
            
            AVAILABLE ACTIONS:
            • click(x, y) - Click precise coordinates
            • type(text) - Enter text in focused fields
            • scroll(x, y, scroll_x, scroll_y) - Scroll page sections
            • keypress(keys) - Keyboard shortcuts
            • wait() - Pause for loading
            
            STRATEGY:
            1. Examine screenshot systematically
            2. Identify key interactive elements
            3. Choose most direct path to goal
            4. Use precise coordinates for reliability
            5. Complete forms methodically
            6. Verify success after each action
            
            IMPORTANT:
            - Be extremely precise with coordinates
            - Look for form fields, buttons, links, dropdowns
            - Read error messages and success indicators
            - Navigate step-by-step toward task completion
            - If stuck, try scrolling or waiting for page loads
            
            RESPOND WITH VALID JSON:
            {
              "action": {
                "type": "click|type|scroll|keypress|wait",
                "x": number,
                "y": number,
                "text": "exact text",
                "keys": ["Enter", "Tab"],
                "scroll_x": 0,
                "scroll_y": 300
              },
              "reasoning": "Why this action advances the task"
            }
            
            TASK COMPLETE FORMAT:
            {
              "complete": true,
              "summary": "Successfully completed task"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `CURRENT TASK: ${agent.instructions}
                
                Analyze this browser screenshot and determine the most logical next action to complete the task.
                
                Look for:
                - Forms that need data entry
                - Buttons to submit or navigate
                - Links to click
                - Fields that require input
                - Error messages or validation issues
                - Success confirmations
                
                Choose the single most important action that progresses toward task completion.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshot}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result;
    } catch (error) {
      console.error('Error in vision processing:', error);
      throw error;
    }
  }

  private async executeAction(page: any, action: ComputerAction): Promise<void> {
    console.log('Executing action:', action);

    switch (action.type) {
      case 'click':
        if (action.x && action.y) {
          await page.mouse.click(action.x, action.y, { 
            button: action.button || 'left' 
          });
        }
        break;

      case 'type':
        if (action.text) {
          await page.keyboard.type(action.text);
        }
        break;

      case 'scroll':
        if (action.x && action.y && action.scroll_x !== undefined && action.scroll_y !== undefined) {
          await page.mouse.move(action.x, action.y);
          await page.evaluate(`window.scrollBy(${action.scroll_x}, ${action.scroll_y})`);
        }
        break;

      case 'keypress':
        if (action.keys) {
          for (const key of action.keys) {
            if (key.toLowerCase() === 'enter') {
              await page.keyboard.press('Enter');
            } else if (key.toLowerCase() === 'space') {
              await page.keyboard.press(' ');
            } else {
              await page.keyboard.press(key);
            }
          }
        }
        break;

      case 'wait':
        await page.waitForTimeout(2000);
        break;

      case 'screenshot':
        // Screenshot is taken automatically after each action
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  private async takeScreenshot(page: any): Promise<string> {
    const screenshot = await page.screenshot({ fullPage: true });
    return screenshot.toString('base64');
  }

  private async cleanupExecutionContext(executionId: number): Promise<void> {
    const context = this.executionContexts.get(executionId);
    if (context) {
      try {
        await context.page.context().browser().close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.executionContexts.delete(executionId);
    }
  }

  async stopExecution(executionId: number): Promise<void> {
    const context = this.executionContexts.get(executionId);
    if (context) {
      await storage.updateTaskExecution(executionId, {
        status: 'failed',
        endTime: new Date(),
        error: 'Execution stopped by user',
      });
      
      await this.cleanupExecutionContext(executionId);
    }
  }
}

export const aiService = new AIService();
