import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Audits from '@/pages/Audits';
import AuditWorkspace from '@/pages/AuditWorkspace';
import Frameworks from '@/pages/Frameworks';
import Owners from '@/pages/Owners';
import Findings from '@/pages/Findings';
import CorrectionPlans from '@/pages/CorrectionPlans';
import Notifications from '@/pages/Notifications';
import Reports from '@/pages/Reports';
import Admin from '@/pages/Admin';
import EvidencePreview from '@/pages/EvidencePreview';
import { Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PermissionRoute from '@/components/PermissionRoute';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<PermissionRoute permission="dashboard_view"><Dashboard /></PermissionRoute>} />
          <Route path="/audits" element={<PermissionRoute permission="audits_view"><Audits /></PermissionRoute>} />
          <Route path="/audits/:id" element={<PermissionRoute permission="audits_view"><AuditWorkspace /></PermissionRoute>} />
          <Route path="/frameworks" element={<PermissionRoute permission="frameworks_view"><Frameworks /></PermissionRoute>} />
          <Route path="/owners" element={<PermissionRoute permission="owners_view"><Owners /></PermissionRoute>} />
          <Route path="/findings" element={<PermissionRoute permission="audits_view"><Findings /></PermissionRoute>} />
          <Route path="/correction-plans" element={<PermissionRoute permission="audits_view"><CorrectionPlans /></PermissionRoute>} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/reports" element={<PermissionRoute permission="reports_view"><Reports /></PermissionRoute>} />
          <Route path="/evidence/:id" element={<EvidencePreview />} />
          <Route path="/admin" element={<PermissionRoute permission="admin_view"><Admin /></PermissionRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App