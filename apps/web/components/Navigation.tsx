'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

const adminLinks = [
  ['Dashboard', '/dashboard'],
  ['Orders', '/orders'],
  ['Fleet', '/fleet'],
  ['Map', '/map'],
] as const;

const driverLinks = [['Driver Workspace', '/driver']] as const;

export function Navigation() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const links = user?.role === 'DRIVER' ? driverLinks : adminLinks;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span aria-hidden="true">LR</span>
        <p className="brand">LogiRoute VN</p>
      </div>
      <nav className="nav" aria-label="Primary navigation">
        {links.map(([label, href]) => (
          <Link
            className={pathname === href ? 'nav-active' : undefined}
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-session">
        {isLoading ? (
          <div className="session-loading" aria-label="Đang tải phiên đăng nhập">
            <span />
            <span />
          </div>
        ) : user ? (
          <>
            <div className="session-user">
              <span className="session-avatar" aria-hidden="true">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>{user.full_name}</strong>
                <small>{user.email}</small>
              </span>
            </div>
            <div className="session-actions">
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {user.role}
              </span>
              <button type="button" onClick={() => void logout()}>
                Đăng xuất
              </button>
            </div>
          </>
        ) : (
          <Link className="sidebar-login-link" href="/login">Đăng nhập</Link>
        )}
      </div>
    </aside>
  );
}
