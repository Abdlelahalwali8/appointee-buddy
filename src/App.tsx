import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { InstallPWA } from "@/components/common/InstallPWA";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Appointments from "./pages/Appointments";
import Patients from "./pages/Patients";
import Doctors from "./pages/Doctors";
import WaitingList from "./pages/WaitingList";
import MedicalRecords from "./pages/MedicalRecords";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import QuickBooking from "./pages/QuickBooking";
import NotFound from "./pages/NotFound";
import Help from "./pages/Help";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <InstallPWA />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/appointments" element={
                <ProtectedRoute>
                  <Appointments />
                </ProtectedRoute>
              } />
              <Route path="/patients" element={
                <ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']}>
                  <Patients />
                </ProtectedRoute>
              } />
              <Route path="/doctors" element={
                <ProtectedRoute>
                  <Doctors />
                </ProtectedRoute>
              } />
              <Route path="/waiting-list" element={
                <ProtectedRoute allowedRoles={['admin', 'receptionist']}>
                  <WaitingList />
                </ProtectedRoute>
              } />
              <Route path="/medical-records" element={
                <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                  <MedicalRecords />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/quick-booking" element={
                <ProtectedRoute allowedRoles={['admin', 'receptionist']}>
                  <QuickBooking />
                </ProtectedRoute>
              } />
              <Route path="/help" element={
                <ProtectedRoute>
                  <Help />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;