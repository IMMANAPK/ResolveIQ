import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/cms/AppSidebar";
import { TopBar } from "@/components/cms/TopBar";
import { useRealtimeTracking } from "@/hooks/useRealtimeTracking";
import { RoleProvider, useRole } from "@/contexts/RoleContext";

export { useRole };

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
  return <TopBar role={role} onRoleChange={setRole} />;
}
