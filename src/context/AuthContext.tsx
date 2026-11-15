import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, clearAuthToken } from '../lib/api';

export type UserRole = 'ELDERLY' | 'FAMILY' | 'CARETAKER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: string;
  avatar_url: string;
  phone: string;
  preferred_language: string;
  accessible_mode: number;
  onboarding_completed: number;
}

export interface CareContext {
  elderlyProfileId: string;
  careCircleId: string;
  memberId: string;
  memberRole: UserRole;
  permissions: {
    can_view_medications: boolean;
    can_manage_medications: boolean;
    can_confirm_doses: boolean;
    can_view_appointments: boolean;
    can_manage_appointments: boolean;
    can_view_medical_vault: boolean;
    can_edit_health_profile: boolean;
    can_receive_escalations: boolean;
  };
}

interface AuthContextValue {
  user: User | null;
  careContext: CareContext | null;
  loading: boolean;
  accessibleMode: boolean;
  highContrast: boolean;
  setAccessibilityFlags: (opts: { accessibleMode?: boolean; highContrast?: boolean }) => Promise<void>;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [careContext, setCareContext] = useState<CareContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const syncDomClasses = useCallback((large: boolean, contrast: boolean) => {
    const root = document.documentElement;
    if (large) root.classList.add('aevora-large-text');
    else root.classList.remove('aevora-large-text');
    if (contrast) root.classList.add('aevora-high-contrast');
    else root.classList.remove('aevora-high-contrast');
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User | null; careContext?: CareContext | null }>('/api/auth/me');
      setUser(data.user);
      setCareContext(data.careContext ?? null);
      const isAcc = Boolean(data.user?.accessible_mode);
      setAccessibleMode(isAcc);
      syncDomClasses(isAcc, isAcc);
    } catch {
      setUser(null);
      setCareContext(null);
    } finally {
      setLoading(false);
    }
  }, [syncDomClasses]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const setAccessibilityFlags = async (opts: { accessibleMode?: boolean; highContrast?: boolean }) => {
    const nextAcc = opts.accessibleMode ?? accessibleMode;
    const nextContrast = opts.highContrast ?? nextAcc;
    setAccessibleMode(nextAcc);
    setHighContrast(nextContrast);
    syncDomClasses(nextAcc, nextContrast);
    if (user) {
      await apiFetch('/api/preferences/accessibility', {
        method: 'PATCH',
        body: JSON.stringify({
          accessibleMode: nextAcc,
          largeText: nextAcc,
          highContrast: nextContrast,
          simplified: nextAcc,
        }),
      }).catch(() => {});
    }
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearAuthToken();
    setUser(null);
    setCareContext(null);
    setAccessibleMode(false);
    setHighContrast(false);
    syncDomClasses(false, false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        careContext,
        loading,
        accessibleMode,
        highContrast,
        setAccessibilityFlags,
        refreshAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
