import {
  LayoutDashboard,
  FileText,
  Bell,
  Shield,
  Bot,
  User,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useRole } from "@/components/cms/CMSLayout";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/types/ui";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Complaints", url: "/complaints", icon: FileText },
    { title: "Notifications", url: "/notifications", icon: Bell },
    { title: "Admin Panel", url: "/admin", icon: Shield },
  ],
  committee: [
    { title: "My Dashboard", url: "/", icon: LayoutDashboard },
    { title: "All Complaints", url: "/complaints", icon: FileText },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ],
  complainant: [
    { title: "My Complaints", url: "/", icon: User },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ],
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  committee: "Committee",
  complainant: "Complainant",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role } = useRole();
  const navItems = navByRole[role];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Bot className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">ResolveIQ</span>
              <span className="text-[10px] text-sidebar-muted">{roleLabels[role]} View</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
