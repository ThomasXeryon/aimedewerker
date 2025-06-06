import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Eye, Play, Pause, Square } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { Agent, TaskExecution } from "@shared/schema";

interface Message {
  id: string;
  type: "user" | "agent" | "system" | "screenshot";
  content: string;
  timestamp: Date;
  screenshot?: string;
  action?: any;
}

interface AgentChatProps {
  agent: Agent;
  execution?: TaskExecution;
  onStartExecution: () => void;
  onStopExecution: () => void;
  onPauseExecution: () => void;
}

export function AgentChat({ 
  agent, 
  execution, 
  onStartExecution, 
  onStopExecution, 
  onPauseExecution 
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useWebSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        
        if (message.type === 'update' && message.data) {
          const { type: updateType, action, screenshot, agentId, executionId } = message.data;
          
          // Only show updates for the current agent
          if (agentId && agentId !== agent.id) return;
          
          switch (updateType) {
            case 'agent_action':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: "agent",
                content: `Executing: ${action.type}${action.x ? ` at (${action.x}, ${action.y})` : ''}${action.text ? ` - "${action.text}"` : ''}`,
                timestamp: new Date(),
                action: action
              }]);
              break;

            case 'agent_screenshot':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: "screenshot",
                content: "Browser screenshot",
                timestamp: new Date(),
                screenshot: screenshot
              }]);
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    const handleLegacyMessage = (data: any) => {
      const { type, payload } = JSON.parse(data);
      
      switch (type) {
        case 'agent_action':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "agent",
            content: `Executing action: ${payload.action.type}`,
            timestamp: new Date(),
            action: payload.action
          }]);
          break;

        case 'agent_screenshot':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "screenshot",
            content: "Browser screenshot",
            timestamp: new Date(),
            screenshot: payload.screenshot
          }]);
          break;

        case 'agent_reasoning':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "agent",
            content: payload.reasoning,
            timestamp: new Date()
          }]);
          break;

        case 'execution_status':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "system",
            content: `Execution status: ${payload.status}`,
            timestamp: new Date()
          }]);
          break;
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const message: Message = {
      id: Date.now().toString(),
      type: "user",
      content: newMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, message]);
    
    // Send human input to agent
    socket.send(JSON.stringify({
      type: 'human_input',
      payload: {
        agentId: agent.id,
        executionId: execution?.id,
        message: newMessage
      }
    }));

    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            {execution && (
              <Badge className={getStatusColor(execution.status)}>
                {execution.status}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!execution || execution.status === 'pending' ? (
              <Button onClick={onStartExecution} size="sm">
                <Play className="w-4 h-4 mr-1" />
                Start
              </Button>
            ) : execution.status === 'running' ? (
              <>
                <Button onClick={onPauseExecution} size="sm" variant="outline">
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </Button>
                <Button onClick={onStopExecution} size="sm" variant="destructive">
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              </>
            ) : null}
            
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>
                    {message.type === "user" ? (
                      <User className="w-4 h-4" />
                    ) : message.type === "screenshot" ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {message.type === "user" ? "You" : 
                       message.type === "screenshot" ? "Screenshot" :
                       message.type === "system" ? "System" : agent.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {message.screenshot ? (
                    <div className="border rounded-lg overflow-hidden">
                      <img 
                        src={`data:image/png;base64,${message.screenshot}`}
                        alt="Browser screenshot"
                        className="w-full max-w-md"
                      />
                    </div>
                  ) : (
                    <div className={`rounded-lg p-3 ${
                      message.type === "user" 
                        ? "bg-blue-500 text-white ml-8" 
                        : "bg-muted"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {message.action && (
                        <div className="mt-2 p-2 bg-black/10 rounded text-xs">
                          <code>{JSON.stringify(message.action, null, 2)}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: "0.1s"}} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: "0.2s"}} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message to guide the agent..."
              disabled={!isConnected}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!newMessage.trim() || !isConnected}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            {isConnected 
              ? "Connected • You can provide guidance and feedback in real-time"
              : "Disconnected • Attempting to reconnect..."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}