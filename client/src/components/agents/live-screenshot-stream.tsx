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
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      
      console.log(`[LiveStream] Connecting to agent ${agentId}`);
      eventSource = new EventSource(`/api/events/${agentId}`);
      
      eventSource.onopen = () => {
        console.log(`[LiveStream] Connected to agent ${agentId}`);
        setIsConnected(true);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'agent_screenshot' && data.screenshot && data.agentId === agentId) {
            console.log(`[LiveStream] Screenshot received for agent ${agentId}, length: ${data.screenshot.length}`);
            
            // Test if this is valid base64 PNG data
            const isValidPNG = data.screenshot.startsWith('iVBORw0KGgo');
            console.log(`[LiveStream] Valid PNG header:`, isValidPNG);
            
            if (isValidPNG) {
              const imageData = "data:image/png;base64," + data.screenshot;
              setFrame(imageData);
              setLastUpdate(Date.now());
              console.log(`[LiveStream] Frame set successfully for agent ${agentId}`);
            } else {
              console.error(`[LiveStream] Invalid PNG data for agent ${agentId}`, data.screenshot.substring(0, 50));
            }
          } else if (data.type === 'connected') {
            console.log(`[LiveStream] Connection confirmed for agent ${data.agentId}`);
          } else if (data.type === 'keepalive') {
            // Keepalive message, no action needed
          } else {
            console.log(`[LiveStream] Received unknown event type:`, data.type, 'for agent:', data.agentId);
          }
        } catch (error) {
          console.error('[LiveStream] Parse error:', error);
        }
      };

      eventSource.onerror = (err) => {
        console.error("[LiveStream] SSE error:", err);
        setIsConnected(false);
        
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        // Reconnect after 3 seconds if still mounted
        if (mounted && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            if (mounted) {
              console.log(`[LiveStream] Reconnecting to agent ${agentId}`);
              connect();
            }
          }, 3000);
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      console.log(`[LiveStream] Cleaning up for agent ${agentId}`);
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      if (eventSource) {
        eventSource.close();
      }
      
      setIsConnected(false);
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
          onLoad={() => console.log(`[LiveStream] Image loaded successfully for agent ${agentId}`)}
          onError={(e) => console.error(`[LiveStream] Image load error for agent ${agentId}:`, e)}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white/70">
          {isConnected ? 'Waiting for screenshots...' : 'Connecting to stream...'}
        </div>
      )}
      
      {/* Debug info */}
      <div className="absolute top-6 right-2 text-xs text-white/70 bg-black/70 px-2 py-1 rounded">
        {frame ? `Frame: ${frame.length} chars` : 'No frame'}
      </div>
      
      {/* Status indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
        {isConnected ? 'LIVE' : 'OFFLINE'} - Agent {agentId}
      </div>
    </div>
  );
}