export const AUTH_COOKIE_NAME = 'logiroute_access_token';
export const USER_ROLES = ['ADMIN', 'DISPATCHER', 'DRIVER'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export type LoginResult = {
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.full_name === 'string' &&
    USER_ROLES.includes(value.role as UserRole) &&
    typeof value.created_at === 'string'
  );
}

export function isLoginResult(value: unknown): value is LoginResult {
  return isRecord(value) && isAuthUser(value.user);
}

export function isLoginInput(value: unknown): value is LoginInput {
  return (
    isRecord(value) &&
    typeof value.email === 'string' &&
    value.email.trim().length > 0 &&
    typeof value.password === 'string' &&
    value.password.length > 0
  );
}
