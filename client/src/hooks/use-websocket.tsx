import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/screenshots`;
    
    const connect = () => {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected successfully");
        setIsConnected(true);
        
        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Authenticate the connection
        socket.send(JSON.stringify({
          type: "authenticate",
          timestamp: new Date().toISOString()
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "authenticated":
              console.log("WebSocket authenticated");
              break;
              
            case "update":
              // Handle real-time updates
              console.log("Received update:", data.data);
              
              // Dispatch custom event for agent chat components to listen to
              window.dispatchEvent(new CustomEvent('websocket-update', {
                detail: data
              }));
              
              // Invalidate relevant queries to trigger refetch
              if (data.data.type === "agent_status_changed") {
                queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
                queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
              }
              
              if (data.data.type === "task_completed" || data.data.type === "task_failed") {
                queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
              }
              
              if (data.data.type === "usage_updated") {
                queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
              }
              break;
              
            default:
              console.log("Unknown WebSocket message type:", data.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isConnected) {
            console.log("Attempting to reconnect WebSocket...");
            connect();
          }
        }, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [queryClient]);

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected: isConnected,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
