import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "@/lib/router";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Audits from "@/pages/Audits";
import AuditWorkspace from "@/pages/AuditWorkspace";
import Frameworks from "@/pages/Frameworks";
import Owners from "@/pages/Owners";
import Findings from "@/pages/Findings";
import CorrectionPlans from "@/pages/CorrectionPlans";
import Notifications from "@/pages/Notifications";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import EvidencePreview from "@/pages/EvidencePreview";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PermissionRoute from "@/components/PermissionRoute";

function ProtectedPage({ permission, children }) {
  return (
    <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}>
      <Layout>
        {permission ? <PermissionRoute permission={permission}>{children}</PermissionRoute> : children}
      </Layout>
    </ProtectedRoute>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  if (authError) {
    if (authError.type === "user_not_registered") return <UserNotRegisteredError />;
    if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedPage permission="dashboard_view"><Dashboard /></ProtectedPage>} />
      <Route path="/audits" element={<ProtectedPage permission="audits_view"><Audits /></ProtectedPage>} />
      <Route path="/audits/:id" element={<ProtectedPage permission="audits_view"><AuditWorkspace /></ProtectedPage>} />
      <Route path="/frameworks" element={<ProtectedPage permission="frameworks_view"><Frameworks /></ProtectedPage>} />
      <Route path="/owners" element={<ProtectedPage permission="owners_view"><Owners /></ProtectedPage>} />
      <Route path="/findings" element={<ProtectedPage permission="audits_view"><Findings /></ProtectedPage>} />
      <Route path="/correction-plans" element={<ProtectedPage permission="audits_view"><CorrectionPlans /></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage><Notifications /></ProtectedPage>} />
      <Route path="/reports" element={<ProtectedPage permission="reports_view"><Reports /></ProtectedPage>} />
      <Route path="/evidence/:id" element={<ProtectedPage><EvidencePreview /></ProtectedPage>} />
      <Route path="/admin" element={<ProtectedPage permission="admin_view"><Admin /></ProtectedPage>} />
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
  );
}

export default App;
