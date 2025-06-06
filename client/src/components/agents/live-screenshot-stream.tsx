import React, { useEffect, useState } from "react";

interface LiveScreenshotStreamProps {
  agentId: number;
  width?: number;
  height?: number;
}

export function LiveScreenshotStream({ 
  agentId, 
  width = 640, 
  height = 480 
}: LiveScreenshotStreamProps) {
  const [frame, setFrame] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log(`Setting up SSE connection for agent ${agentId}`);
    const eventSource = new EventSource(`/api/events/${agentId}`);
    
    eventSource.onopen = () => {
      console.log('SSE connected for live screenshots');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message received:', data.type);
        if (data.type === 'agent_screenshot' && data.screenshot) {
          console.log('📸 Received screenshot from SSE, size:', data.screenshot.length);
          setFrame("data:image/png;base64," + data.screenshot);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
        console.log('Raw event data:', event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [agentId]);

  return (
    <div className="relative border rounded bg-black" style={{ width, height }}>
      {/* Connection status */}
      <div className="absolute top-2 right-2 z-10">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      
      {/* Screenshot display */}
      {frame ? (
        <img 
          src={frame} 
          alt="Live Agent View" 
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white/70">
          {isConnected ? 'Waiting for screenshots...' : 'Connecting to stream...'}
        </div>
      )}
      
      {/* Status indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
        {isConnected ? 'LIVE' : 'OFFLINE'} - Agent {agentId}
      </div>
    </div>
  );
}