import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/cms/StatusBadge";
import { Button } from "@/components/ui/button";
import { complaints } from "@/data/mock";

export default function ComplaintList() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Complaints</h1>
        <p className="mt-1 text-sm text-muted-foreground">All filed complaints and their current status</p>
      </div>

      <div className="card-surface overflow-hidden">
        {/* Table header */}
        <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">ID</div>
          <div className="col-span-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Priority</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Viewed</div>
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {complaints.map((c, i) => {
            const seen = c.recipients.filter(r => r.seen).length;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors duration-150 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-1 text-xs font-medium text-muted-foreground tabular-nums">{c.id}</div>
                <div className="col-span-4">
                  <p className="text-sm font-medium text-foreground">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                    {c.priority} · {c.status} · {seen}/{c.recipients.length} seen
                  </p>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge priority={c.priority}>{c.priority}</StatusBadge>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge status={c.status}>{c.status}</StatusBadge>
                </div>
                <div className="col-span-2 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{seen}/{c.recipients.length} Seen</span>
                </div>
                <div className="col-span-1">
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
