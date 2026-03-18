import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/cms/AppSidebar";
import { TopBar } from "@/components/cms/TopBar";
import { useRealtimeTracking } from "@/hooks/useRealtimeTracking";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/ui";

export { useRole };

// Which UI roles a user is allowed to switch between based on their assigned roles array
function getAllowedRoles(apiRoles?: string[]): UserRole[] {
  if (!apiRoles || apiRoles.length === 0) return ["admin"];
  const allowed = new Set<UserRole>();
  if (apiRoles.includes("admin") || apiRoles.includes("manager")) allowed.add("admin");
  if (apiRoles.includes("committee_member")) allowed.add("committee");
  if (apiRoles.includes("complainant")) allowed.add("complainant");
  return allowed.size > 0 ? Array.from(allowed) : ["admin"];
}

export function CMSLayout() {
  useRealtimeTracking();

  return (
    <RoleProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <TopBarWithRole />
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </RoleProvider>
  );
}

function TopBarWithRole() {
  const { role, setRole } = useRole();
  const { user } = useAuth();
  const allowedRoles = getAllowedRoles(user?.roles);
  return <TopBar role={role} onRoleChange={setRole} allowedRoles={allowedRoles} />;
}
