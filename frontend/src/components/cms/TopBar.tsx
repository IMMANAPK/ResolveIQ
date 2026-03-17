import { Search, Bell, ChevronDown } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types/ui";

interface TopBarProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  allowedRoles?: UserRole[]; // if only 1 option, renders a static badge instead of a dropdown
}

const roleLabels: Record<UserRole, string> = {
  complainant: "Complainant",
  committee: "Committee Member",
  admin: "Admin",
};

export function TopBar({ role, onRoleChange, allowedRoles }: TopBarProps) {
  const options = allowedRoles ?? (Object.keys(roleLabels) as UserRole[]);
  const canSwitch = options.length > 1;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="text-muted-foreground" />

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search complaints..."
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Notifications icon */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-critical" />
        </Button>

        {/* Role Switcher — dropdown for admin, static badge for others */}
        {canSwitch ? (
          <Select value={role} onValueChange={(v) => onRoleChange(v as UserRole)}>
            <SelectTrigger className="h-9 w-auto gap-2 border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((key) => (
                <SelectItem key={key} value={key}>{roleLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground">
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            {roleLabels[role]}
          </span>
        )}

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          AD
        </div>
      </div>
    </header>
  );
}
