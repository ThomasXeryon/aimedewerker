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
        if (data.type === 'agent_screenshot' && data.screenshot) {
          console.log('Received screenshot from SSE');
          setFrame("data:image/png;base64," + data.screenshot);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
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
    <div className="relative">
      {!isConnected && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
          Connecting to live stream...
        </div>
      )}
      {frame ? (
        <img 
          src={frame} 
          width={width} 
          height={height} 
          alt="Live Agent View" 
          className="border rounded"
        />
      ) : (
        <div 
          className="bg-gray-100 border rounded flex items-center justify-center text-gray-500"
          style={{ width, height }}
        >
          Waiting for screenshots...
        </div>
      )}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {isConnected ? '🔴 LIVE' : '⚫ OFFLINE'}
      </div>
    </div>
  );
}