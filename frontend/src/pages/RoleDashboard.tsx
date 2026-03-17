import { useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import ComplainantDashboard from "@/pages/ComplainantDashboard";
import CommitteeDashboard from "@/pages/CommitteeDashboard";

export default function RoleDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "complainant") return <ComplainantDashboard />;
  if (user.role === "committee_member") return <CommitteeDashboard />;
  if (user.role === "manager") return <CommitteeDashboard />; // Managers see similar dashboard as committee
  return <Dashboard />;
}
