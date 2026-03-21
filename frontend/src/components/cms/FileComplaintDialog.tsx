import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateComplaint } from "@/hooks/useComplaints";
import { FileDropzone } from "@/components/cms/FileDropzone";
import { useUploadAttachment } from "@/hooks/useAttachments";
import type { ApiComplaintCategory, ApiComplaintPriority } from "@/types/api";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(["hr", "it", "facilities", "conduct", "safety", "other"] as const),
  priority: z.enum(["low", "medium", "high", "critical"] as const),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileComplaintDialog({ open, onOpenChange }: Props) {
  const createComplaint = useCreateComplaint();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [newComplaintId, setNewComplaintId] = useState<string | null>(null);
  const uploadAttachment = useUploadAttachment(newComplaintId ?? '');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium", category: "hr" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const complaint = await createComplaint.mutateAsync(data);
      setNewComplaintId(complaint.id);
      for (const file of attachmentFiles) {
        await uploadAttachment.mutateAsync(file).catch((e) => {
          console.error(`Failed to upload ${file.name}`, e);
        });
      }
      setAttachmentFiles([]);
      setNewComplaintId(null);
      toast.success("Complaint filed successfully");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to file complaint. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>File a New Complaint</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief summary of your complaint"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              rows={4}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                defaultValue="hr"
                onValueChange={(v) => setValue("category", v as ApiComplaintCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="facilities">Facilities</SelectItem>
                  <SelectItem value="conduct">Conduct</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                defaultValue="medium"
                onValueChange={(v) => setValue("priority", v as ApiComplaintPriority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-xs text-destructive">{errors.priority.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Attachments (optional, max 3)</label>
            <FileDropzone files={attachmentFiles} onChange={setAttachmentFiles} />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createComplaint.isPending}>
              {createComplaint.isPending ? "Submitting..." : "Submit Complaint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
