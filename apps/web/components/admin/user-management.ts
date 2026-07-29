import {
  isAuthUser,
  type AuthUser,
  type UserStatus,
} from '../../lib/auth/contracts';

export function isAdminUserList(value: unknown): value is AuthUser[] {
  return Array.isArray(value) && value.every(isAuthUser);
}

export function nextAccountAction(status: UserStatus): 'ACTIVE' | 'SUSPENDED' {
  return status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
}
