import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function RecentTasks() {
  const { data: executions, isLoading } = useQuery({
    queryKey: ["/api/executions"],
    refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
  });

  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-32 mb-1" />
                  <Skeleton className="h-2 w-24" />
                </div>
                <Skeleton className="h-2 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-400";
      case "running":
        return "bg-blue-400";
      case "failed":
        return "bg-red-400";
      case "pending":
        return "bg-amber-400";
      default:
        return "bg-slate-400";
    }
  };

  const getAgentName = (agentId: number) => {
    const agent = agents?.find((a: any) => a.id === agentId);
    return agent?.name || `Agent ${agentId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Tasks</CardTitle>
      </CardHeader>
      
      <CardContent className="p-3">
        {!executions || executions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No recent tasks found.
          </div>
        ) : (
          <div className="space-y-1">
            {executions.slice(0, 8).map((execution: any) => (
              <div key={execution.id} className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(execution.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {execution.status === "completed" ? "Task completed" : 
                     execution.status === "running" ? "Task running" :
                     execution.status === "failed" ? "Task failed" : "Task pending"}
                  </p>
                  <p className="text-xs text-slate-500">{getAgentName(execution.agentId)}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(execution.startTime), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="p-6 border-t border-slate-200">
          <Button variant="ghost" className="w-full text-center text-primary hover:text-primary/80">
            View All Tasks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
