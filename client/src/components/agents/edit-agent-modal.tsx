
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Agent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
}

export function EditAgentModal({ open, onOpenChange, agent }: EditAgentModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
    priority: "normal" as const,
    framerate: 2
  });

  // Update form data when agent changes
  useEffect(() => {
    if (open && agent) {
      let config: any = {};
      try {
        if (agent.config && typeof agent.config === 'string') {
          config = JSON.parse(agent.config);
        }
      } catch (e) {
        console.warn('Failed to parse agent config:', e);
      }

      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        instructions: agent.instructions || "",
        priority: agent.priority || "normal",
        framerate: config.framerate || 2
      });
    }
  }, [open, agent]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!agent) return;

    setIsLoading(true);
    try {
      const updatePayload = {
        name: formData.name,
        description: formData.description,
        instructions: formData.instructions,
        priority: formData.priority,
        config: JSON.stringify({
          framerate: formData.framerate
        })
      };

      await apiRequest("PATCH", `/api/agents/${agent.id}`, updatePayload);

      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      toast({
        title: "Agent updated",
        description: "Changes have been saved successfully",
      });
      handleClose();
    } catch (error: any) {
      toast({
        title: "Failed to update agent",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Only render if open and we have an agent
  if (!open || !agent) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit Agent: {agent.name}</h2>
          <Button 
            variant="ghost" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClose();
            }}
          >
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Agent name"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description"
            />
          </div>

          <div>
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="What should this agent do?"
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Screenshot Framerate: {formData.framerate} fps</Label>
            <Slider
              min={0.5}
              max={10}
              step={0.5}
              value={[formData.framerate]}
              onValueChange={(value) => setFormData({ ...formData, framerate: value[0] })}
              className="w-full mt-2"
            />
            <div className="text-sm text-muted-foreground mt-1">
              Controls how often screenshots are captured (0.5-10 fps)
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Agent"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
