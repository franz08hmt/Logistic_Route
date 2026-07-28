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
import { useRouter } from 'next/navigation';

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

function errorMessage(payload: unknown, status: number): string {
  if (status === 401) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (
    isRecord(payload) &&
    typeof payload.detail === 'string' &&
    payload.detail.trim()
  ) {
    return payload.detail;
  }

  return `Đăng nhập thất bại (HTTP ${status}).`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  const login = useCallback(async (input: LoginInput) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await responsePayload(response);

    if (!response.ok) {
      throw new Error(errorMessage(payload, response.status));
    }
    if (!isLoginResult(payload)) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    }

    setUser(payload.user);
    router.replace(payload.user.role === 'DRIVER' ? '/driver' : '/dashboard');
    router.refresh();
  }, [router]);

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

        if (response.status === 401) {
          await clearSession();
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
  }, [clearSession]);

  useEffect(() => {
    function handleUnauthorized() {
      void logout();
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [logout]);

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
