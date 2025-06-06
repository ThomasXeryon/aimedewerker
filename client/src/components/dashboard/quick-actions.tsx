import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";

export function QuickActions() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const actions = [
    {
      icon: "fas fa-plus",
      title: "Create New Agent",
      description: "Set up automated tasks",
      onClick: () => setShowCreateModal(true),
      color: "primary",
    },
    {
      icon: "fas fa-user-plus",
      title: "Invite Team Member",
      description: "Add collaborators",
      onClick: () => console.log("Invite team member"),
      color: "emerald",
    },
    {
      icon: "fas fa-book",
      title: "View Documentation",
      description: "Learn how to build agents",
      onClick: () => window.open("https://platform.openai.com/docs/guides/tools-computer-use", "_blank"),
      color: "sky",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      primary: "bg-primary/10 text-primary",
      emerald: "bg-emerald-100 text-emerald-600",
      sky: "bg-sky-100 text-sky-600",
    };
    return colors[color as keyof typeof colors] || colors.primary;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-full h-auto p-3 justify-start"
              onClick={action.onClick}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(action.color)}`}>
                  <i className={action.icon} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-slate-900">{action.title}</p>
                  <p className="text-xs text-slate-500">{action.description}</p>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

      <CreateAgentModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />
    </>
  );
}
