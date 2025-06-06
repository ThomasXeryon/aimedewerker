import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function ActiveAgents() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["/api/agents"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-800";
      case "paused":
        return "bg-amber-100 text-amber-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return "w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5";
      case "paused":
        return "w-1.5 h-1.5 bg-amber-400 rounded-full mr-1.5";
      case "error":
        return "w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5";
      default:
        return "w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5";
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "web_scraper":
        return "fas fa-robot text-primary";
      case "social_media":
        return "fas fa-robot text-sky-600";
      case "form_filler":
        return "fas fa-robot text-purple-600";
      default:
        return "fas fa-robot text-primary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Agents</CardTitle>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {!agents || agents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No agents found. Create your first agent to get started.
          </div>
        ) : (
          <div className="space-y-6">
            {agents.slice(0, 5).map((agent: any) => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className={getAgentIcon(agent.type)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{agent.name}</h3>
                    <p className="text-sm text-slate-600">{agent.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <Badge variant="secondary" className={getStatusColor(agent.status)}>
                        <div className={getStatusIcon(agent.status)} />
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Last run: {agent.lastRun 
                          ? formatDistanceToNow(new Date(agent.lastRun), { addSuffix: true })
                          : "Never"
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <i className="fas fa-chart-line" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <i className="fas fa-edit" />
                  </Button>
                  {agent.status === "active" ? (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <i className="fas fa-stop-circle" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                      <i className="fas fa-play-circle" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
