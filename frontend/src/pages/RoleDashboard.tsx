import { useRole } from "@/components/cms/CMSLayout";
import Dashboard from "@/pages/Dashboard";
import ComplainantDashboard from "@/pages/ComplainantDashboard";
import CommitteeDashboard from "@/pages/CommitteeDashboard";

export default function RoleDashboard() {
  const { role } = useRole();

  if (role === "complainant") return <ComplainantDashboard />;
  if (role === "committee") return <CommitteeDashboard />;
  return <Dashboard />;
}
