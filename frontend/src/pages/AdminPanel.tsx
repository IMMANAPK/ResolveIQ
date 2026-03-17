import { motion } from "framer-motion";
import { Mail, Eye, Bell, UserCheck, AlertTriangle, Loader2, Users } from "lucide-react";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserManagement from "./UserManagement";

const stepIcon: Record<string, React.ElementType> = {
  reminder: Bell,
  reroute: UserCheck,
  multi_channel: AlertTriangle,
  TRIGGERED: Bell,
  COMPLETED: Mail,
};

const stepBg: Record<string, string> = {
  reminder: "bg-status-ai/10",
  reroute: "bg-status-high/10",
  multi_channel: "bg-status-critical/10",
};

const stepText: Record<string, string> = {
  reminder: "text-status-ai",
  reroute: "text-status-high",
  multi_channel: "text-status-critical",
};

export default function AdminPanel() {
  const { data: history, isLoading } = useQuery({
    queryKey: ['escalation-history'],
    queryFn: () => apiFetch<any[]>('/escalation/history'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin Control Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage users and monitor system escalations</p>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="history" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Escalation Logs
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> User Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="mt-6 space-y-4">
          <div className="card-surface overflow-hidden">
            <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
              <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</div>
              <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</div>
              <div className="col-span-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Complaint</div>
              <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Target User</div>
              <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Timestamp</div>
            </div>

            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : history?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No activity logs found.</div>
              ) : (
                history?.map((log, i) => {
                  const Icon = stepIcon[log.step] || Bell;
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-1 gap-2 px-5 py-3.5 transition-colors duration-150 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                    >
                      <div className="col-span-1">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", stepBg[log.step] || "bg-muted")}>
                          <Icon className={cn("h-3.5 w-3.5", stepText[log.step] || "text-muted-foreground")} />
                        </div>
                      </div>
                      <div className="col-span-3 text-sm font-medium text-foreground capitalize">{log.step.replace('_', ' ')}</div>
                      <div className="col-span-4 text-sm text-muted-foreground truncate">{log.complaint?.title || 'Unknown'}</div>
                      <div className="col-span-2">
                        <StatusBadge className="bg-muted text-foreground">
                          {log.targetUser?.fullName || 'System'}
                        </StatusBadge>
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
