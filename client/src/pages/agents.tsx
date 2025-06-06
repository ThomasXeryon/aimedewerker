import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";
import { EditAgentModal } from "@/components/agents/edit-agent-modal";
import { AgentChat } from "@/components/agents/agent-chat-fixed";
import { Plus, Bot, Play, Pause, Square, Eye, Calendar, Edit } from "lucide-react";
import { Agent, TaskExecution } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Agents() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null);
  const { toast } = useToast();



  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: executions = [] } = useQuery<TaskExecution[]>({
    queryKey: ["/api/executions"],
  });

  const startExecutionMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/execute`);
      return res.json();
    },
    onSuccess: (execution) => {
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      setSelectedExecution(execution);
      toast({
        title: "Agent started",
        description: "Browser automation is now running",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stopExecutionMutation = useMutation({
    mutationFn: async (executionId: number) => {
      const res = await apiRequest("POST", `/api/executions/${executionId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      setSelectedExecution(null);
      toast({
        title: "Agent stopped",
        description: "Execution has been terminated",
      });
    },
  });

  const pauseExecutionMutation = useMutation({
    mutationFn: async (executionId: number) => {
      const res = await apiRequest("POST", `/api/executions/${executionId}/pause`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      toast({
        title: "Agent paused",
        description: "Execution has been paused",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (selectedAgent) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        
        <div className="flex-1 flex flex-col">
          <Header />
          
          <main className="flex-1 flex">
            <div className="w-1/3 p-6 border-r bg-slate-50">
              <div className="mb-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedAgent(null)}
                  size="sm"
                >
                  ← Back to Agents
                </Button>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      {selectedAgent.name}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        console.log('Edit button clicked for agent:', selectedAgent);
                        // Use setTimeout to ensure state updates don't conflict
                        setTimeout(() => {
                          setEditingAgent(selectedAgent);
                          setEditModalOpen(true);
                        }, 0);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Type:</span>
                      <p className="text-sm text-muted-foreground">{selectedAgent.type}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Target:</span>
                      <p className="text-sm text-muted-foreground">{selectedAgent.targetWebsite || 'Any website'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Instructions:</span>
                      <p className="text-sm text-muted-foreground">{selectedAgent.instructions}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Status:</span>
                      <Badge className={getStatusColor(selectedAgent.status || 'inactive')}>
                        {selectedAgent.status || 'inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Executions */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Executions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executions
                      .filter(e => e.agentId === selectedAgent.id)
                      .slice(0, 5)
                      .map((execution) => (
                        <div 
                          key={execution.id}
                          className={`p-3 rounded-lg border cursor-pointer hover:bg-slate-50 ${
                            selectedExecution?.id === execution.id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => setSelectedExecution(execution)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge className={getExecutionStatusColor(execution.status)}>
                              {execution.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(execution.startTime).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex-1 p-6">
              <AgentChat
                agent={selectedAgent}
                execution={selectedExecution}
                onStartExecution={() => startExecutionMutation.mutate(selectedAgent.id)}
                onStopExecution={() => selectedExecution && stopExecutionMutation.mutate(selectedExecution.id)}
                onPauseExecution={() => selectedExecution && pauseExecutionMutation.mutate(selectedExecution.id)}
              />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 overflow-auto bg-slate-50">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AI Agents</h1>
              <p className="text-slate-600 mt-1">Create and manage browser automation agents</p>
            </div>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded mb-4"></div>
                  <div className="h-3 bg-slate-200 rounded mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded mb-4"></div>
                  <div className="h-8 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bot className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No agents yet</h3>
                <p className="text-slate-600 mb-6">Create your first AI agent to automate browser tasks</p>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Agent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => {
                const recentExecution = executions.find(e => e.agentId === agent.id) || undefined;
                
                return (
                  <Card key={agent.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="w-5 h-5" />
                          {agent.name}
                        </CardTitle>
                        <Badge className={getStatusColor(agent.status || 'inactive')}>
                          {agent.status || 'inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Type</p>
                        <p className="text-sm font-medium">{agent.type}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Target</p>
                        <p className="text-sm font-medium">{agent.targetWebsite || 'Any website'}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Instructions</p>
                        <p className="text-sm line-clamp-2">{agent.instructions}</p>
                      </div>

                      {recentExecution && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Last run:</span>
                            <Badge className={getExecutionStatusColor(recentExecution.status)}>
                              {recentExecution.status}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-4">
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent);
                          }}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            startExecutionMutation.mutate(agent.id);
                            setSelectedAgent(agent);
                          }}
                          disabled={startExecutionMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Run
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
      
      <CreateAgentModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
      />
      
      <EditAgentModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        agent={editingAgent}
      />
    </div>
  );
}
