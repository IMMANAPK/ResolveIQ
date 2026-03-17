import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CMSLayout } from "@/components/cms/CMSLayout";
import ComplaintList from "@/pages/ComplaintList";
import ComplaintDetail from "@/pages/ComplaintDetail";
import Notifications from "@/pages/Notifications";
import AdminPanel from "@/pages/AdminPanel";
import RoleDashboard from "@/pages/RoleDashboard";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <CMSLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<RoleDashboard />} />
              <Route path="/complaints" element={<ComplaintList />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
