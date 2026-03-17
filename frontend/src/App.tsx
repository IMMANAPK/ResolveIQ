import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CMSLayout } from "@/components/cms/CMSLayout";
import Dashboard from "@/pages/Dashboard";
import ComplaintList from "@/pages/ComplaintList";
import ComplaintDetail from "@/pages/ComplaintDetail";
import Notifications from "@/pages/Notifications";
import AdminPanel from "@/pages/AdminPanel";
import ComplainantDashboard from "@/pages/ComplainantDashboard";
import CommitteeDashboard from "@/pages/CommitteeDashboard";
import RoleDashboard from "@/pages/RoleDashboard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<CMSLayout />}>
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
  </QueryClientProvider>
);

export default App;
