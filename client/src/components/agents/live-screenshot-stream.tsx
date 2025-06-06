import { useEffect, useState } from "react";

interface LiveScreenshotStreamProps {
  agentId: number;
  width?: number;
  height?: number;
  framerate?: number;
}

export function LiveScreenshotStream({ 
  agentId, 
  width = 640, 
  height = 480,
  framerate = 2
}: LiveScreenshotStreamProps) {
  const [frame, setFrame] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    console.log(`[LiveStream] Setting up SSE for agent ${agentId}`);
    const eventSource = new EventSource(`/api/events/${agentId}`);
    
    eventSource.onopen = () => {
      console.log(`[LiveStream] Connected to agent ${agentId}`);
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      console.log(`[LiveStream] Message received:`, event.data.substring(0, 100) + '...');
      try {
        const data = JSON.parse(event.data);
        console.log(`[LiveStream] Parsed message type: ${data.type}`);
        
        if (data.type === 'agent_screenshot' && data.screenshot) {
          console.log(`[LiveStream] Screenshot received, length: ${data.screenshot.length}`);
          setFrame("data:image/png;base64," + data.screenshot);
          setLastUpdate(Date.now());
        } else if (data.type === 'connected') {
          console.log(`[LiveStream] Initial connection confirmed for agent ${data.agentId}`);
        }
      } catch (error) {
        console.error('[LiveStream] Parse error:', error);
        console.log('[LiveStream] Raw data:', event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[LiveStream] SSE error:", err);
      setIsConnected(false);
    };

    return () => {
      console.log(`[LiveStream] Closing SSE for agent ${agentId}`);
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