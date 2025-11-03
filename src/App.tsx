import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Bootstrap from "./pages/Bootstrap";
import Dashboard from "./pages/Dashboard";
import DatasetManagement from "./pages/DatasetManagement";
import Training from "./pages/Training";
import Recognition from "./pages/Recognition";
import Attendance from "./pages/Attendance";
import InstitutionManagement from "./pages/InstitutionManagement";
import DepartmentAdminManagement from "./pages/DepartmentAdminManagement";
import UserManagement from "./pages/UserManagement";
import AttendanceReports from "./pages/AttendanceReports";
import StudentAttendance from "./pages/StudentAttendance";
import BatchOperations from "./pages/BatchOperations";
import AuditLogs from "./pages/AuditLogs";
import MobileAttendance from "./pages/MobileAttendance";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/bootstrap" element={<Bootstrap />} />
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/institutions" element={<InstitutionManagement />} />
              <Route path="/departments" element={<DepartmentAdminManagement />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/dataset" element={<DatasetManagement />} />
              <Route path="/training" element={<Training />} />
              <Route path="/recognition" element={<Recognition />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/attendance-reports" element={<AttendanceReports />} />
              <Route path="/my-attendance" element={<StudentAttendance />} />
              <Route path="/batch-operations" element={<BatchOperations />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/mobile-attendance" element={<MobileAttendance />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
