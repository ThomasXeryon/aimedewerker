import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";

export function Header() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">Monitor and manage your AI agents</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Input
                type="text" 
                placeholder="Search agents, tasks..." 
                className="pl-10 w-64"
              />
              <i className="fas fa-search absolute left-3 top-3 text-slate-400" />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <i className="fas fa-bell text-xl" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>
            
            {/* Create Agent Button */}
            <Button onClick={() => setShowCreateModal(true)}>
              <i className="fas fa-plus mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      </header>

      <CreateAgentModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />
    </>
  );
}
