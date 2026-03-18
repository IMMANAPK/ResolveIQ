import { createContext, useContext, useState, ReactNode } from "react";
import type { UserRole } from "@/types/ui";
import type { ApiUserRole } from "@/types/api";
import { useAuth } from "@/contexts/AuthContext";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

export const RoleContext = createContext<RoleContextType>({ role: "admin", setRole: () => {} });

export function useRole() {
  return useContext(RoleContext);
}

// Map an array of API roles → the primary UI role for the initial view
function toUiRole(apiRoles: ApiUserRole[] | undefined): UserRole {
  if (!apiRoles || apiRoles.length === 0) return "admin";
  if (apiRoles.includes("admin") || apiRoles.includes("manager")) return "admin";
  if (apiRoles.includes("committee_member")) return "committee";
  return "complainant";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(() => toUiRole(user?.roles));
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
