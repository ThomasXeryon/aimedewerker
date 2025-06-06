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
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/screenshots`;
    console.log(`Attempting WebSocket connection to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected for live screenshots');
      setIsConnected(true);
      // Subscribe to screenshots for this agent
      socket.send(JSON.stringify({ 
        type: 'subscribe', 
        agentId: agentId 
      }));
      console.log(`Subscribed to screenshots for agent ${agentId}`);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'screenshot' && data.data) {
          console.log('📸 Received screenshot from WebSocket');
          setFrame("data:image/png;base64," + data.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        // Fallback: try treating as raw base64 data
        setFrame("data:image/png;base64," + event.data);
      }
    };

    socket.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      setIsConnected(false);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => socket.close();
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