import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const navigationItems = [
    { href: "/", label: "Dashboard", icon: "fas fa-tachometer-alt", active: location === "/" },
    { href: "/agents", label: "AI Agents", icon: "fas fa-robot", badge: stats?.activeAgents },
    { href: "/tasks", label: "Task Queue", icon: "fas fa-tasks", badge: 8 },
    { href: "/analytics", label: "Analytics", icon: "fas fa-chart-line" },
    { href: "/billing", label: "Billing", icon: "fas fa-credit-card" },
    { href: "/team", label: "Team", icon: "fas fa-users" },
    { href: "/settings", label: "Settings", icon: "fas fa-cog" },
  ];

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo and Organization Selector */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">AgentScale</h1>
        </div>
        
        {organization && (
          <div className="relative">
            <Button variant="ghost" className="w-full justify-start p-3 h-auto">
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {organization.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left flex-1">
                  <p className="font-medium text-slate-900 text-sm">{organization.name}</p>
                  <p className="text-xs text-slate-500">{organization.plan} Plan</p>
                </div>
              </div>
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-left font-medium ${
                    item.active
                      ? "bg-primary/10 text-primary hover:bg-primary/10"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <i className={`${item.icon} w-5 mr-3`} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-6 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback className="bg-slate-100">
              {user?.username?.slice(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 truncate">{user?.username}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <i className="fas fa-sign-out-alt" />
          </Button>
        </div>
      </div>
    </div>
  );
}
