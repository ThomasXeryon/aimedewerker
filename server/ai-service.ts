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
  duration?: number;
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
      viewport: { width: 1280, height: 720 },
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
    const viewport = page.viewportSize();
    console.log(`Browser initialized with viewport: ${viewport.width}x${viewport.height}`);
    let screenshot = await this.takeScreenshot(page);
    context.screenshots.push(screenshot);

    try {
      // Use OpenAI Computer Use API matching the exact Python example format
      const computerUseResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "computer-use-preview",
          tools: [{
            type: "computer_use_preview",
            display_width: 1280,
            display_height: 720,
            environment: "browser"
          }],
          input: [{
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Complete this task: ${agent.instructions}`
              },
              {
                type: "input_image",
                input_image: {
                  type: "base64",
                  media_type: "image/png",
                  data: screenshot
                }
              }
            ]
          }],
          reasoning: { summary: "concise" },
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
            content: `You are an expert browser automation agent with precise computer vision. Your task: ${agent.instructions}

            CRITICAL VIEWPORT INFO:
            - Screenshot dimensions: EXACTLY 1280x720 pixels
            - Coordinate system: (0,0) at top-left, (1279,719) at bottom-right
            - You MUST provide coordinates within this exact range
            - Click coordinates must be precise pixel locations within the screenshot

            COORDINATE PRECISION RULES:
            - Study the screenshot pixel-by-pixel to identify exact element locations
            - Click in the CENTER of buttons, links, and form fields
            - Account for visual padding, borders, and element spacing
            - For text fields: click in the middle of the input area
            - For buttons: click dead center of the button text/area
            - Never use coordinates outside 0-1279 (width) or 0-719 (height)
            
            VISUAL ANALYSIS PROCESS:
            1. Scan entire screenshot from top-left to bottom-right
            2. Identify ALL clickable elements: buttons, links, inputs, dropdowns
            3. Read all visible text, labels, error messages, success indicators
            4. Determine current page state and required next action
            5. Calculate EXACT pixel coordinates for the target element
            
            ACTION TYPES:
            • click - Click exact pixel coordinates (x, y)
            • type - Type text in currently focused field
            • scroll - Scroll page (scroll_x, scroll_y values)
            • keypress - Press keyboard keys (Enter, Tab, Space, etc.)
            • wait - Pause for page loading (duration in ms)
            
            COORDINATE CALCULATION:
            - Measure element boundaries visually in the screenshot
            - Find the center point of the target element
            - Verify coordinates are reasonable for 1024x768 viewport
            - Avoid edges and borders - aim for element center
            
            RESPOND WITH VALID JSON ONLY:
            {
              "action": {
                "type": "click|type|scroll|keypress|wait",
                "x": exact_pixel_number,
                "y": exact_pixel_number,
                "text": "exact text to type",
                "keys": ["Enter", "Tab", "Space"],
                "scroll_x": horizontal_scroll_pixels,
                "scroll_y": vertical_scroll_pixels,
                "duration": milliseconds_to_wait
              },
              "reasoning": "Specific explanation of why these exact coordinates and action will advance the task"
            }
            
            COMPLETION FORMAT:
            {
              "complete": true,
              "summary": "Task completed successfully with specific outcome details"
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

    try {
      switch (action.type) {
        case 'click':
          if (typeof action.x === 'number' && typeof action.y === 'number') {
            // Get actual viewport size and check scaling
            const viewport = page.viewportSize();
            console.log(`Current viewport: ${viewport.width}x${viewport.height}`);
            console.log(`Raw coordinates received: (${action.x}, ${action.y})`);
            
            // Ensure coordinates are within viewport bounds
            const x = Math.max(0, Math.min(action.x, viewport.width - 1));
            const y = Math.max(0, Math.min(action.y, viewport.height - 1));
            
            console.log(`Adjusted coordinates: (${x}, ${y})`);
            await page.mouse.click(x, y, { 
              button: action.button || 'left',
              delay: 100
            });
          } else {
            console.warn('Invalid click coordinates:', action.x, action.y);
          }
          break;

        case 'type':
          if (action.text) {
            // Simply type the text without clearing - let the AI handle field selection
            await page.keyboard.type(action.text, { delay: 50 });
          }
          break;

        case 'scroll':
          if (typeof action.scroll_x === 'number' && typeof action.scroll_y === 'number') {
            console.log(`Scrolling by: (${action.scroll_x}, ${action.scroll_y})`);
            await page.evaluate(`window.scrollBy(${action.scroll_x}, ${action.scroll_y})`);
          }
          break;

        case 'keypress':
          if (action.keys && Array.isArray(action.keys)) {
            for (const key of action.keys) {
              const keyStr = key.toString();
              if (keyStr.toLowerCase() === 'enter') {
                await page.keyboard.press('Enter');
              } else if (keyStr.toLowerCase() === 'tab') {
                await page.keyboard.press('Tab');
              } else if (keyStr.toLowerCase() === 'space') {
                await page.keyboard.press('Space');
              } else {
                await page.keyboard.press(keyStr);
              }
              await page.waitForTimeout(100);
            }
          }
          break;

        case 'wait':
          const waitTime = action.duration || 2000;
          console.log(`Waiting for ${waitTime}ms`);
          await page.waitForTimeout(waitTime);
          break;

        case 'screenshot':
          // Screenshot is taken automatically after each action
          break;

        default:
          console.warn('Unknown action type:', action.type);
      }

      // Wait a bit after each action for stability
      await page.waitForTimeout(500);

    } catch (error) {
      console.error('Error executing action:', error);
      throw error;
    }
  }

  private async takeScreenshot(page: any): Promise<string> {
    const viewport = page.viewportSize();
    console.log(`Taking screenshot with viewport: ${viewport.width}x${viewport.height}`);
    
    const screenshot = await page.screenshot({ 
      fullPage: false, // Use viewport size, not full page
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height }
    });
    
    const base64Screenshot = screenshot.toString('base64');
    console.log(`Screenshot captured for ${viewport.width}x${viewport.height} viewport`);
    
    // Stream screenshot to WebSocket clients
    this.streamScreenshotToClients(base64Screenshot);
    
    return base64Screenshot;
  }

  private streamScreenshotToClients(screenshot: string): void {
    const wss = (globalThis as any).screenshotWss;
    if (!wss) return;

    // Broadcast screenshot to all connected WebSocket clients
    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify({
            type: 'screenshot',
            data: screenshot,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error('Error streaming screenshot:', error);
        }
      }
    });
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
