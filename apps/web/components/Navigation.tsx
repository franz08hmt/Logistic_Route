import Link from 'next/link';

const links = [
  ['Dashboard', '/dashboard'],
  ['Orders', '/orders'],
  ['Fleet', '/fleet'],
  ['Map', '/map'],
] as const;

export function Navigation() {
  return (
    <aside className="sidebar">
      <p className="brand">LogiRoute VN</p>
      <nav className="nav" aria-label="Primary navigation">
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </aside>
  );
}

