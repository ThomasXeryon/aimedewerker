import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ActiveAgents } from "@/components/dashboard/active-agents";
import { RecentTasks } from "@/components/dashboard/recent-tasks";
import { UsageOverview } from "@/components/dashboard/usage-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";

export default function Dashboard() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 overflow-auto bg-slate-50">
          <StatsCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2">
              <ActiveAgents />
            </div>
            
            <div className="space-y-8">
              <RecentTasks />
              <UsageOverview />
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
