import { useState, createContext, useContext } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/cms/AppSidebar";
import { TopBar } from "@/components/cms/TopBar";
import type { UserRole } from "@/data/mock";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({ role: "admin", setRole: () => {} });

export function useRole() {
  return useContext(RoleContext);
}

export function CMSLayout() {
  const [role, setRole] = useState<UserRole>("admin");

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <TopBar role={role} onRoleChange={setRole} />
            <main className="flex-1 overflow-auto p-6">
              <Outlet context={{ role }} />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </RoleContext.Provider>
  );
}
