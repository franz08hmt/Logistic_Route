export const AUTH_COOKIE_NAME = 'logiroute_access_token';
export const USER_ROLES = ['ADMIN', 'DISPATCHER', 'DRIVER'] as const;
export const USER_STATUSES = ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED'] as const;
export const SELF_REGISTER_ROLES = ['DISPATCHER', 'DRIVER'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
};

export type LoginResult = {
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  full_name: string;
  email: string;
  password: string;
  phone_number: string | null;
  role: SelfRegisterRole;
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
    (typeof value.phone_number === 'string' || value.phone_number === null) &&
    USER_ROLES.includes(value.role as UserRole) &&
    USER_STATUSES.includes(value.status as UserStatus) &&
    typeof value.created_at === 'string' &&
    !('hashed_password' in value)
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

export function isRegisterInput(value: unknown): value is RegisterInput {
  return (
    isRecord(value) &&
    typeof value.full_name === 'string' &&
    value.full_name.trim().length >= 2 &&
    typeof value.email === 'string' &&
    value.email.includes('@') &&
    typeof value.password === 'string' &&
    value.password.length >= 6 &&
    (typeof value.phone_number === 'string' || value.phone_number === null) &&
    SELF_REGISTER_ROLES.includes(value.role as SelfRegisterRole)
  );
}
