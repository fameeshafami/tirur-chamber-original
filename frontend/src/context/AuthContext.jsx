import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getStoredAuth, saveAuthSession, clearAuthSession, apiRequest } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Refresh the stored profile so changed permissions are applied on the next session.
  useEffect(() => {
    const auth = getStoredAuth();
    if (auth) {
      setUser(auth.user);
      setToken(auth.token);
      apiRequest('/auth/me')
        .then((data) => {
          if (data.user) {
            if (['admin', 'super_admin'].includes(data.user.role) && (data.user.status !== 'active' || data.user.isActive === false)) {
              clearAuthSession();
              setUser(null);
              setToken(null);
              return;
            }
            saveAuthSession(auth.token, data.user);
            setUser(data.user);
          }
        })
        .catch((error) => {
          if (error.status === 401) {
            clearAuthSession();
            setUser(null);
            setToken(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((tok, usr) => {
    saveAuthSession(tok, usr);
    setToken(tok);
    setUser(usr);
  }, []);

  const logout = useCallback(() => {
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/me');
      if (data.user) {
        const auth = getStoredAuth();
        if (auth) {
          saveAuthSession(auth.token, data.user);
          setUser(data.user);
        }
      }
    } catch {
      // token expired / invalid — log out silently
      logout();
    }
  }, [logout]);

  const isAdmin         = ['admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin    = user?.role === 'super_admin';
  const isShopOwner     = user?.role === 'shop_owner';
  const isJobSeeker     = user?.role === 'job_seeker';
  const isChamberMember = user?.role === 'chamber_member';
  const isLoggedIn      = !!user && !!token;

  const canAccessAdminSection = useCallback((section) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.role === 'admin' && (section === 'dashboard' || user.permissions?.[section] === true);
  }, [user]);

  const dashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin':
        return '/admin';
      case 'super_admin':    return '/super-admin';
      case 'shop_owner':     return '/shop-owner';
      case 'job_seeker':     return '/job-seeker';
      case 'chamber_member': return '/chamber-member';
      default:               return '/';
    }
  };

  const roleLabel = () => {
    const map = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      shop_owner: 'Shop Owner',
      job_seeker: 'Job Seeker',
      chamber_member: 'Chamber Member',
    };
    return user ? (map[user.role] ?? 'User') : '';
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, refreshUser,
      isAdmin, isSuperAdmin, isShopOwner, isJobSeeker, isChamberMember, isLoggedIn,
      canAccessAdminSection,
      dashboardPath, roleLabel,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
