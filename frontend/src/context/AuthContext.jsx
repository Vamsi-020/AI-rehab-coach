/**
 * AuthContext — global authentication state for the React app.
 *
 * Provides:
 *   - user        Current user object (or null)
 *   - token       JWT access token string (or null)
 *   - isAuthenticated  Boolean derived from token presence
 *   - login(email, password)           → calls API, stores token + user
 *   - register(name, email, pwd, role) → calls API, stores token + user
 *   - logout()                         → clears token + user
 *
 * State is persisted to localStorage so refreshes don't log users out.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../api/client';

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

/**
 * useAuth — consume the AuthContext from any child component.
 * Throws if called outside of <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'rehab_token';
const USER_KEY = 'rehab_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Keep localStorage in sync whenever token / user changes
  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Log in with email + password.
   * On success, stores the token and user in state + localStorage.
   * Throws on failure so calling components can show error messages.
   */
  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Register a new account, then automatically log in.
   * Returns the created user object.
   */
  const register = useCallback(async (full_name, email, password, role = 'patient') => {
    // Register the account
    await api.register(full_name, email, password, role);
    // Immediately log in to get a token
    const data = await api.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Log out — clears all stored auth state.
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
