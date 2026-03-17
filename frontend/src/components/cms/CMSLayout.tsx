import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/cms/AppSidebar";
import { TopBar } from "@/components/cms/TopBar";
import { useRealtimeTracking } from "@/hooks/useRealtimeTracking";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/ui";

export { useRole };

// Which UI roles a given API role is allowed to switch between
function getAllowedRoles(apiRole?: string): UserRole[] {
  if (apiRole === "admin") return ["admin", "committee", "complainant"];
  if (apiRole === "committee_member") return ["committee"];
  if (apiRole === "complainant") return ["complainant"];
  if (apiRole === "manager") return ["admin"];
  return ["admin"];
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
  const allowedRoles = getAllowedRoles(user?.role);
  return <TopBar role={role} onRoleChange={setRole} allowedRoles={allowedRoles} />;
}
