import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Agent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface AgentEditOverlayProps {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentEditOverlay({ agent, onClose }: AgentEditOverlayProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("normal");
  const [framerate, setFramerate] = useState(2);

  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setInstructions(agent.instructions || "");
      setPriority(agent.priority || "normal");
      
      // Parse config for framerate
      let config: any = {};
      try {
        if (agent.config && typeof agent.config === 'string') {
          config = JSON.parse(agent.config);
        }
      } catch (e) {
        console.warn('Failed to parse agent config:', e);
      }
      setFramerate(config.framerate || 2);
    }
  }, [agent]);

  if (!agent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {
        name,
        description,
        instructions,
        priority,
        config: JSON.stringify({ framerate })
      };

      await apiRequest("PATCH", `/api/agents/${agent.id}`, updateData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent updated successfully",
        description: "Your changes have been saved",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to update agent",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Edit Agent: {agent.name}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-6 overflow-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Agent Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agent name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the agent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-instructions">Instructions</Label>
              <Textarea
                id="edit-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="What should this agent do?"
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-framerate">Framerate (FPS)</Label>
              <Input
                id="edit-framerate"
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={framerate}
                onChange={(e) => setFramerate(parseFloat(e.target.value) || 2)}
              />
              <p className="text-xs text-gray-500">
                Controls how often screenshots are taken (0.5 to 10 FPS)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}