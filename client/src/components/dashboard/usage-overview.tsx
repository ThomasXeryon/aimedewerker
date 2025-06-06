import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function UsageOverview() {
  const { data: usage, isLoading } = useQuery({
    queryKey: ["/api/usage"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const apiCallsUsed = usage?.quota?.apiUsed || 0;
  const apiCallsLimit = usage?.quota?.apiCalls || 1000;
  const apiCallsPercentage = (apiCallsUsed / apiCallsLimit) * 100;

  const browserSessions = usage?.usage?.browserSessions || 0;
  const browserSessionsLimit = 500; // This would come from plan limits
  const browserSessionsPercentage = (browserSessions / browserSessionsLimit) * 100;

  const storageUsed = usage?.usage?.storageUsed || 0;
  const storageLimit = 5000; // 5GB in MB
  const storagePercentage = (storageUsed / storageLimit) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Overview</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">API Calls</span>
              <span className="font-medium text-slate-900">
                {apiCallsUsed.toLocaleString()} / {apiCallsLimit.toLocaleString()}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={apiCallsPercentage} className="h-2" />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Browser Sessions</span>
              <span className="font-medium text-slate-900">
                {browserSessions} / {browserSessionsLimit}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={browserSessionsPercentage} className="h-2" />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Storage</span>
              <span className="font-medium text-slate-900">
                {(storageUsed / 1000).toFixed(1)} GB / {(storageLimit / 1000)} GB
              </span>
            </div>
            <div className="mt-2">
              <Progress value={storagePercentage} className="h-2" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Billing cycle ends in</span>
            <span className="text-sm font-medium text-slate-900">12 days</span>
          </div>
          <Button variant="secondary" className="w-full mt-3">
            Manage Billing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
