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

// Map the real JWT role → UI role switcher type
function toUiRole(apiRole: ApiUserRole | undefined): UserRole {
  if (apiRole === "committee_member") return "committee";
  if (apiRole === "complainant") return "complainant";
  return "admin"; // admin + manager both use admin view
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(() => toUiRole(user?.role));
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
