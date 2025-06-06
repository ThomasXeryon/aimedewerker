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
      executablePath: '/usr/bin/chromium',
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

    // Navigate to target website if specified
    if (agent.targetWebsite) {
      await page.goto(agent.targetWebsite);
    }

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

    // For now, use a simplified approach until the Computer Use API is fully available
    // This implements the core computer automation logic manually
    let response = await this.processTaskWithVision(agent, screenshot);

    while (iteration < maxIterations) {
      iteration++;

      try {
        if (!response.action) {
          console.log('No action in response. Task may be complete.');
          break;
        }

        console.log('Executing action:', response.action);
        await this.executeAction(page, response.action);
        context.actions.push(response.action);

        // Take screenshot after action
        screenshot = await this.takeScreenshot(page);
        context.screenshots.push(screenshot);

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

  private async processTaskWithVision(agent: Agent, screenshot: string): Promise<{action?: ComputerAction, complete?: boolean}> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI agent that controls a web browser to complete tasks. 
            
            Agent Type: ${agent.type}
            Instructions: ${agent.instructions}
            
            You can perform these actions:
            - click(x, y, button="left") - Click at coordinates
            - type(text) - Type text
            - scroll(x, y, scroll_x, scroll_y) - Scroll at coordinates
            - keypress(keys) - Press keyboard keys
            - wait() - Wait briefly
            - screenshot() - Take a screenshot
            
            Analyze the current screenshot and determine the next action to complete the task.
            If the task is complete, respond with "TASK_COMPLETE".
            
            Respond with JSON in this format:
            {
              "action": {
                "type": "click|type|scroll|keypress|wait|screenshot",
                "x": number,
                "y": number,
                "button": "left|right",
                "text": "text to type",
                "keys": ["key1", "key2"],
                "scroll_x": number,
                "scroll_y": number
              },
              "reasoning": "Explanation of why this action is needed"
            }
            
            Or if complete:
            {
              "complete": true,
              "summary": "Task completion summary"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Current screenshot of the browser. What action should I take next?"
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
