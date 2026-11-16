import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, logout as apiLogout } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('geosand_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('geosand_token');
    if (token) {
      getMe()
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem('geosand_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          setUser(null);
          localStorage.removeItem('geosand_token');
          localStorage.removeItem('geosand_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((userData, token) => {
    setUser(userData);
    localStorage.setItem('geosand_token', token);
    localStorage.setItem('geosand_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (e) {
      // ignore
    }
    setUser(null);
    localStorage.removeItem('geosand_token');
    localStorage.removeItem('geosand_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
