import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Send, User, Bot, Eye } from "lucide-react";
import type { Agent, TaskExecution } from "@shared/schema";
import { LiveScreenshotStream } from "./live-screenshot-stream";

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
  const [isConnected, setIsConnected] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    const startEventStream = () => {
      eventSource = new EventSource(`/api/events/${agent.id}`);
      
      eventSource.onopen = () => {
        console.log('Event stream connected for agent', agent.id);
        setIsConnected(true);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received event:', data);
          
          switch (data.type) {
            case 'connected':
              setMessages(prev => [...prev, {
                id: `connect-${Date.now()}`,
                type: "system",
                content: "Connected to live browser automation",
                timestamp: new Date()
              }]);
              break;
              
            case 'agent_action':
              setMessages(prev => [...prev, {
                id: `action-${Date.now()}`,
                type: "agent",
                content: `${data.action.type}${data.action.x ? ` at (${data.action.x}, ${data.action.y})` : ''}${data.action.text ? ` - "${data.action.text}"` : ''}`,
                timestamp: new Date(),
                action: data.action
              }]);
              break;

            case 'agent_screenshot':
              setMessages(prev => [...prev, {
                id: `screenshot-${Date.now()}`,
                type: "screenshot",
                content: "Browser view",
                timestamp: new Date(),
                screenshot: data.screenshot
              }]);
              break;
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      };
      
      eventSource.onerror = () => {
        console.log('Event stream error, reconnecting...');
        setIsConnected(false);
        eventSource?.close();
        setTimeout(startEventStream, 3000);
      };
    };
    
    startEventStream();
    
    return () => {
      eventSource?.close();
      setIsConnected(false);
    };
  }, [agent.id]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: "user",
      content: newMessage,
      timestamp: new Date()
    }]);

    setNewMessage("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{agent.name}</h3>
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            </div>
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
        {/* Live Screenshot Stream */}
        {execution && execution.status === 'running' && (
          <div className="p-4 border-b bg-gray-50">
            <div className="text-sm font-medium mb-2 text-gray-700">Live Browser View</div>
            <LiveScreenshotStream agentId={agent.id} width={640} height={400} />
          </div>
        )}

        
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
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
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message to the agent..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
            />
            <Button onClick={sendMessage} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}