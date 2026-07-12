import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loginWithCredentials,
  signupWithCredentials,
  logout as apiLogout,
  getUser,
  loginWithGoogle as loginWithGoogleService,
  loginWithGithub as loginWithGithubService,
} from '../services/auth';
import { getAccessToken, clearTokens } from '../services/token';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setIsLoading(false);
    }, 8000); // Safety: stop loading after 8s if auth check hangs

    const initAuth = async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const currentUser = await getUser();
        if (cancelled) return;
        if (currentUser) {
          setIsAuthenticated(true);
          setUser(currentUser);
        } else {
          clearTokens();
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        clearTokens();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initAuth();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loginWithCredentials(email, password);
      if (result.success) {
        const currentUser = await getUser();
        setUser(currentUser);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginWithGoogle = async () => {
    return await loginWithGoogleService();
  };

  const handleLoginWithGithub = async () => {
    return await loginWithGithubService();
  };

  const signup = async (email, password, name) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signupWithCredentials(email, password, name);
      if (result.success) {
        const currentUser = await getUser();
        setUser(currentUser);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await apiLogout();
    } catch {
      // Ignore — tokens cleared regardless
    }
    setIsAuthenticated(false);
    setUser(null);
    setIsLoading(false);
  };

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        return { success: true, user: currentUser };
      } else {
        setIsAuthenticated(false);
        setUser(null);
        return { success: false };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        error,
        login,
        signup,
        logout: handleLogout,
        loginWithGoogle: handleLoginWithGoogle,
        loginWithGithub: handleLoginWithGithub,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
