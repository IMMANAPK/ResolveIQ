import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Eye, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface BackendComplaint {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  raisedBy?: { fullName: string };
  // Add other fields as needed
}

export default function ComplaintList() {
  const { user } = useAuth();
  const { data: complaints, isLoading, error } = useQuery({
    queryKey: ['complaints', user?.role],
    queryFn: () => {
      const endpoint = user?.role === 'complainant' ? '/complaints/my' : '/complaints';
      return apiFetch<BackendComplaint[]>(endpoint);
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-6 text-center text-destructive">
        <p className="font-medium">Failed to load complaints</p>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Complaints</h1>
        <p className="mt-1 text-sm text-muted-foreground">All filed complaints and their current status</p>
      </div>

      <div className="card-surface overflow-hidden">
        {/* Table header */}
        <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">ID</div>
          <div className="col-span-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {complaints?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No complaints found.
            </div>
          )}
          {complaints?.map((c, i) => {
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors duration-150 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-2 text-xs font-medium text-muted-foreground truncate" title={c.id}>{c.id.split('-')[0]}...</div>
                <div className="col-span-4">
                  <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                    {c.priority} · {c.status}
                  </p>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge priority={c.priority as any}>{c.priority}</StatusBadge>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge status={c.status as any}>{c.status}</StatusBadge>
                </div>
                <div className="col-span-2">
                  <Button variant="ghost" size="sm" asChild className="text-xs text-primary">
                    <Link to={`/complaints/${c.id}`}>View</Link>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
