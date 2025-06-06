import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = registerRoutes(app);
  
  // Set up WebSocket server for screenshot streaming
  import('ws').then(({ WebSocketServer }) => {
    const wss = new WebSocketServer({ 
      server, 
      path: '/api/ws/screenshots',
      verifyClient: (info) => {
        console.log('WebSocket connection attempt from:', info.origin);
        return true;
      }
    });
    
    wss.on('connection', (ws: any, req: any) => {
      console.log('✓ Screenshot stream client connected from:', req.url);
      
      ws.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'subscribe' && data.agentId) {
            ws.agentId = data.agentId;
            console.log(`✓ Client subscribed to agent ${data.agentId} screenshots`);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('❌ Screenshot stream client disconnected');
      });
      
      ws.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    wss.on('error', (error) => {
      console.error('❌ WebSocket Server error:', error);
    });

    (globalThis as any).screenshotWss = wss;
    console.log('WebSocket screenshot server initialized on /api/ws/screenshots');
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
