import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/cms/AppSidebar";
import { TopBar } from "@/components/cms/TopBar";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function CMSLayout() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <TopBar user={user} onLogout={logout} />
          <main className="flex-1 overflow-auto p-6">
            <Outlet context={{ user }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
