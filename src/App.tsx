import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import TaskDetail from "./pages/TaskDetail";
import MyTasks from "./pages/MyTasks";
import AdminUsers from "./pages/AdminUsers";
import MemberManagement from "./pages/MemberManagement";
import NotFound from "./pages/NotFound";
import AdminAuthPage from "./pages/AdminAuthPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* /auth chuyển hướng về /auth/member để tránh lỗi cũ */}
      <Route path="/auth" element={<Navigate to="/auth/member" replace />} />
      <Route path="/auth/member" element={<Auth />} />
      <Route path="/auth/admin" element={<AdminAuthPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      <Route path="/groups/:groupId/tasks/:taskId" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/members" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/tasks" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/scores" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/groups" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/accounts" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;