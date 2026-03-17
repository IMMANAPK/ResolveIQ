import { createContext, useContext, useState, ReactNode } from "react";
import type { UserRole } from "@/data/mock";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

export const RoleContext = createContext<RoleContextType>({ role: "admin", setRole: () => {} });

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("admin");
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
