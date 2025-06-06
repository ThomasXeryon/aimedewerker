import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: usage } = useQuery({
    queryKey: ["/api/usage"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Active Agents",
      value: stats?.activeAgents || 0,
      change: "+2 from last week",
      icon: "fas fa-robot",
      color: "primary",
    },
    {
      label: "Tasks Completed",
      value: stats?.completedTasks || 0,
      change: "+15% from last month",
      icon: "fas fa-check-circle",
      color: "emerald",
    },
    {
      label: "Success Rate",
      value: `${stats?.successRate || 0}%`,
      change: "+1.2% from last week",
      icon: "fas fa-chart-pie",
      color: "sky",
    },
    {
      label: "Usage This Month",
      value: `${usage?.usage?.apiCalls || 0}`,
      change: `API calls remaining: ${(usage?.quota?.apiCalls || 1000) - (usage?.quota?.apiUsed || 0)}`,
      icon: "fas fa-bolt",
      color: "amber",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      primary: "bg-primary/10 text-primary",
      emerald: "bg-emerald-100 text-emerald-600",
      sky: "bg-sky-100 text-sky-600",
      amber: "bg-amber-100 text-amber-600",
    };
    return colors[color as keyof typeof colors] || colors.primary;
  };

  const getChangeColor = (index: number) => {
    return index === 3 ? "text-amber-600" : "text-emerald-600";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={card.label} className="bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{card.value}</p>
                <p className={`text-sm mt-2 flex items-center ${getChangeColor(index)}`}>
                  <i className={`fas ${index === 3 ? 'fa-clock' : 'fa-arrow-up'} mr-1`} />
                  <span>{card.change}</span>
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses(card.color)}`}>
                <i className={`${card.icon} text-xl`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
