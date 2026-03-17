import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CMSLayout } from "@/components/cms/CMSLayout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import ComplaintList from "@/pages/ComplaintList";
import ComplaintDetail from "@/pages/ComplaintDetail";
import Notifications from "@/pages/Notifications";
import AdminPanel from "@/pages/AdminPanel";
import RoleDashboard from "@/pages/RoleDashboard";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><CMSLayout /></ProtectedRoute>}>
              <Route path="/" element={<RoleDashboard />} />
              <Route path="/complaints" element={<ComplaintList />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
