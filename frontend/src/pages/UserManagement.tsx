import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/useUsers";
import { AddUserDialog } from "@/components/cms/AddUserDialog";
import { ImportUsersDialog } from "@/components/cms/ImportUsersDialog";
import type { ApiUserRole } from "@/types/api";

const ROLE_BADGE: Record<ApiUserRole, { label: string; classes: string }> = {
  complainant:      { label: "Complainant",  classes: "bg-blue-100 text-blue-700" },
  committee_member: { label: "Committee",    classes: "bg-purple-100 text-purple-700" },
  manager:          { label: "Manager",      classes: "bg-orange-100 text-orange-700" },
  admin:            { label: "Admin",        classes: "bg-gray-100 text-gray-700" },
};

function RoleBadge({ role }: { role: ApiUserRole }) {
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.complainant;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function UserManagement() {
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { data: users = [], isLoading } = useUsers();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system users and bulk import from Excel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import from Excel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add User
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="hidden border-b border-border bg-muted/30 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</div>
          <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</div>
          <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Department</div>
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</div>
          <div className="col-span-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No users yet. Add one or import from Excel.
          </div>
        )}

        <div className="divide-y divide-border">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-1 gap-2 px-5 py-3.5 hover:bg-muted/30 sm:grid-cols-12 sm:items-center sm:gap-4"
            >
              <div className="col-span-3 text-sm font-medium text-foreground truncate">{user.fullName}</div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{user.email}</div>
              <div className="col-span-2"><RoleBadge role={user.role} /></div>
              <div className="col-span-2 text-sm text-muted-foreground truncate">{user.department || "—"}</div>
              <div className="col-span-1"><ActiveBadge isActive={user.isActive} /></div>
              <div className="col-span-1 text-xs text-muted-foreground tabular-nums">{fmtDate(user.createdAt)}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportUsersDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
