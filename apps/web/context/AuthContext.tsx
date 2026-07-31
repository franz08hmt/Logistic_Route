'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useI18n } from '@/context/I18nContext';
import {
  type AuthUser,
  type LoginInput,
  isAuthUser,
  isLoginResult,
  isRecord,
} from '@/lib/auth/contracts';
import {
  AUTH_UNAUTHORIZED_EVENT,
  backendProxyPath,
} from '@/lib/api-client';
import type { TranslationKey } from '@/lib/i18n/i18n';
import { getSessionRestoreRedirect } from '@/lib/auth/route-access';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function responsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorMessage(
  payload: unknown,
  status: number,
  t: (key: TranslationKey) => string,
): string {
  if (status === 401) {
    return t('auth.invalidCredentials');
  }

  if (status === 403 && isRecord(payload) && typeof payload.detail === 'string') {
    return payload.detail.includes('chờ')
      ? t('auth.pendingApproval')
      : t('auth.suspended');
  }

  if (
    isRecord(payload) &&
    typeof payload.detail === 'string' &&
    payload.detail.trim()
  ) {
    return payload.detail;
  }

  return t('auth.loginError');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    router.replace('/login');
    router.refresh();
  }, [clearSession, router]);

  const clearExpiredSession = useCallback(async () => {
    await clearSession();
    const redirectPath = getSessionRestoreRedirect(pathname);
    if (redirectPath) {
      router.replace(redirectPath);
      router.refresh();
    }
  }, [clearSession, pathname, router]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await responsePayload(response);

    if (!response.ok) {
      throw new Error(errorMessage(payload, response.status, t));
    }
    if (!isLoginResult(payload)) {
      throw new Error(t('auth.invalidResponse'));
    }

    setUser(payload.user);
    router.replace(payload.user.role === 'DRIVER' ? '/driver' : '/dashboard');
    router.refresh();
  }, [router, t]);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const response = await fetch(
          backendProxyPath('/api/v1/auth/me'),
          { cache: 'no-store' },
        );
        const payload = await responsePayload(response);

        if (response.ok && isAuthUser(payload)) {
          if (isActive) {
            setUser(payload);
          }
          return;
        }

        if (response.status === 401 || response.status === 403) {
          if (isActive) {
            await clearExpiredSession();
          }
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();
    return () => {
      isActive = false;
    };
  }, [clearExpiredSession]);

  useEffect(() => {
    function handleUnauthorized() {
      void clearExpiredSession();
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearExpiredSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
  }), [isLoading, login, logout, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
