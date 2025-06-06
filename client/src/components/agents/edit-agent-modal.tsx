import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { insertAgentSchema, Agent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const editAgentSchema = insertAgentSchema.extend({
  framerate: z.number().min(0.5).max(10).default(2),
}).transform(data => ({
  ...data,
  description: data.description || ""
}));

type EditAgentData = z.infer<typeof editAgentSchema>;

interface EditAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
}

export function EditAgentModal({ open, onOpenChange, agent }: EditAgentModalProps) {
  const { toast } = useToast();
  


  const form = useForm<EditAgentData>({
    resolver: zodResolver(editAgentSchema),
    defaultValues: {
      name: agent?.name || "",
      description: agent?.description || "",
      instructions: agent?.instructions || "",
      priority: agent?.priority || "normal",
      framerate: (agent as any)?.config?.framerate || 2,
    },
  });

  // Reset form when agent changes or modal opens
  useEffect(() => {
    if (agent) {
      let config: any = {};
      try {
        if (agent.config && typeof agent.config === 'string') {
          config = JSON.parse(agent.config);
        }
      } catch (e) {
        console.warn('Failed to parse agent config:', e);
        config = {};
      }
      
      form.reset({
        name: agent.name || "",
        description: agent.description || "",
        instructions: agent.instructions || "",
        priority: agent.priority || "normal",
        framerate: config.framerate || 2,
      });
    }
  }, [agent, form]);

  const updateAgentMutation = useMutation({
    mutationFn: async (data: EditAgentData) => {
      if (!agent) throw new Error("No agent to update");
      
      // Prepare update payload with config
      const updatePayload = {
        name: data.name,
        description: data.description,
        instructions: data.instructions,
        priority: data.priority,
        config: JSON.stringify({
          framerate: data.framerate
        })
      };
      
      const res = await apiRequest("PATCH", `/api/agents/${agent.id}`, updatePayload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      toast({
        title: "Agent updated",
        description: "Changes have been saved successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditAgentData) => {
    console.log('Submitting agent update:', data);
    updateAgentMutation.mutate(data);
  };

  if (!open || !agent) return null;

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Agent name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What should this agent do?"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="framerate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Screenshot Framerate: {field.value} fps</FormLabel>
                  <FormControl>
                    <Slider
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="w-full"
                    />
                  </FormControl>
                  <div className="text-sm text-muted-foreground">
                    Controls how often screenshots are captured (0.5-10 fps)
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateAgentMutation.isPending}
              >
                {updateAgentMutation.isPending ? "Updating..." : "Update Agent"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}