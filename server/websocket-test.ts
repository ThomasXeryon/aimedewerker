// Test WebSocket connection and broadcast functionality
import { WebSocketServer, WebSocket } from 'ws';

export function testWebSocketBroadcast() {
  // Simulate real browser automation updates
  const demoUpdates = [
    {
      type: 'agent_action',
      agentId: 2,
      action: { type: 'navigate', url: 'https://httpbin.org/forms/post' }
    },
    {
      type: 'agent_screenshot',
      agentId: 2,
      screenshot: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    },
    {
      type: 'agent_action',
      agentId: 2,
      action: { type: 'type', x: 150, y: 200, text: 'AgentScale Demo' }
    },
    {
      type: 'agent_action',
      agentId: 2,
      action: { type: 'click', x: 200, y: 300, button: 'left' }
    }
  ];

  let updateIndex = 0;
  
  return setInterval(() => {
    if ((global as any).broadcastUpdate && updateIndex < demoUpdates.length) {
      const update = demoUpdates[updateIndex];
      console.log('Broadcasting demo update:', update.type);
      (global as any).broadcastUpdate(1, update);
      updateIndex++;
    }
  }, 2000);
}