import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protects a dashboard page.
 * requiredRole: 'admin' | 'shop_owner' | 'job_seeker' | 'chamber_member'
 * If user is not logged in → /login
 * If user is logged in but wrong role → their own dashboard
 */
export default function DashGuard({ requiredRole, children }) {
  const { user, loading, isLoggedIn, dashboardPath } = useAuth();
  const navigate = useNavigate();
  const hasRequiredRole = user?.role === requiredRole || (requiredRole === 'admin' && user?.role === 'super_admin');
  const inactiveAdmin = ['admin', 'super_admin'].includes(user?.role) && user?.status !== 'active';

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      navigate('/login', { replace: true });
      return;
    }
    if (inactiveAdmin) {
      navigate('/login', { replace: true });
      return;
    }
    if (requiredRole && !hasRequiredRole) {
      navigate(dashboardPath(), { replace: true });
    }
  }, [loading, isLoggedIn, inactiveAdmin, hasRequiredRole, requiredRole, navigate, dashboardPath]);

  if (loading || !isLoggedIn || inactiveAdmin || (requiredRole && !hasRequiredRole)) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner" aria-label="Loading…" />
      </div>
    );
  }

  return children;
}
