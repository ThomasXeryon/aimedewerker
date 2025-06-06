import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
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
  const isConnectedRef = useRef(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connect = () => {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        isConnectedRef.current = true;
        
        // Authenticate the connection
        socket.send(JSON.stringify({
          type: "authenticate",
          // In a real implementation, send auth token here
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
        isConnectedRef.current = false;
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (!isConnectedRef.current) {
            console.log("Attempting to reconnect WebSocket...");
            connect();
          }
        }, 5000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [queryClient]);

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected: isConnectedRef.current,
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
