import { Search, Bell, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { User } from "@/context/AuthContext";

interface TopBarProps {
  user: User;
  onLogout: () => void;
}

export function TopBar({ user, onLogout }: TopBarProps) {
  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

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
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground">{user.fullName}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
        </div>

        {/* Notifications icon */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-critical" />
        </Button>

        {/* Logout */}
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground">
          <LogOut className="h-4 w-4" />
        </Button>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initials}
        </div>
      </div>
    </header>
  );
}
