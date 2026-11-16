import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Layouts
import PublicLayout from '../components/Layout/PublicLayout';
import DashboardLayout from '../components/Layout/DashboardLayout';

// Public pages
import Landing from '../pages/public/Landing';
import QuarryDetail from '../pages/public/QuarryDetail';
import BeAnOperatorPage from '../components/BeAnOperatorModal';

// Common protected pages
import Notifications from '../pages/Notifications';

// Auth
import Login from '../pages/auth/Login';

// Admin pages
import AdminDashboard from '../pages/admin/Dashboard';
import AdminUsers from '../pages/admin/Users';
import AdminQuarries from '../pages/admin/Quarries';
import AdminOperatorApplications from '../pages/admin/OperatorApplications';
import AdminHauling from '../pages/admin/HaulingRecords';
import AdminCheckpoints from '../pages/admin/Checkpoints';
import AuditTrail from '../pages/admin/AuditTrail';
import MonitoringReports from '../pages/admin/MonitoringReports';
import OperationsMap from '../pages/admin/OperationsMap';
import SystemMaintenance from '../pages/admin/SystemMaintenance';

// Operator pages
import OperatorDashboard from '../pages/operator/Dashboard';
import OperatorStaff from '../pages/operator/Staff';
import NewHauling from '../pages/operator/NewHauling';
import HaulingHistory from '../pages/operator/HaulingHistory';

// Staff pages
import StaffDashboard from '../pages/staff/Dashboard';
import StaffHistory from '../pages/staff/HaulingHistory';

// Checkpoint pages
import CheckpointDashboard from '../pages/checkpoint/Dashboard';
import CheckpointHistory from '../pages/checkpoint/History';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

export default function AppRouter() {
  const { user } = useAuth();

  const getDashboardRedirect = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin/dashboard';
      case 'quarry_operator': return '/operator/dashboard';
      case 'quarry_staff': return '/staff/dashboard';
      case 'checkpoint_officer': return '/checkpoint/dashboard';
      default: return '/';
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/quarry/:id" element={<QuarryDetail />} />
          <Route path="/be-an-operator" element={user ? <Navigate to={getDashboardRedirect()} replace /> : <BeAnOperatorPage />} />
        </Route>
        
        {/* Login */}
        <Route path="/login" element={
          user ? <Navigate to={getDashboardRedirect()} replace /> : <Login />
        } />

        {/* Common Protected routes */}
        <Route element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<Navigate to={getDashboardRedirect()} replace />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="quarries" element={<AdminQuarries />} />
          <Route path="operator-applications" element={<AdminOperatorApplications />} />
          <Route path="hauling-records" element={<AdminHauling />} />
          <Route path="checkpoints" element={<AdminCheckpoints />} />
          <Route path="audit-trail" element={<AuditTrail />} />
          <Route path="monitoring" element={<MonitoringReports />} />
          <Route path="operations-map" element={<OperationsMap />} />
          <Route path="system-maintenance" element={<SystemMaintenance />} />
        </Route>

        {/* Operator routes */}
        <Route path="/operator" element={
          <ProtectedRoute roles={['quarry_operator']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/operator/dashboard" replace />} />
          <Route path="dashboard" element={<OperatorDashboard />} />
          <Route path="staff" element={<OperatorStaff />} />
          <Route path="new-hauling" element={<NewHauling />} />
          <Route path="history" element={<HaulingHistory />} />
        </Route>

        {/* Staff routes */}
        <Route path="/staff" element={
          <ProtectedRoute roles={['quarry_staff']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="new-hauling" element={<NewHauling />} />
          <Route path="history" element={<StaffHistory />} />
        </Route>

        {/* Checkpoint routes */}
        <Route path="/checkpoint" element={
          <ProtectedRoute roles={['checkpoint_officer']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/checkpoint/dashboard" replace />} />
          <Route path="dashboard" element={<CheckpointDashboard />} />
          <Route path="history" element={<CheckpointHistory />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
