import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TabBar() {
  const location = useLocation();
  const { isLoggedIn, dashboardPath } = useAuth();

  const tabs = [
    { href: '/',          icon: '🏠', label: 'Home' },
    { href: '/directory', icon: '🏪', label: 'Directory' },
    { href: '/jobs',      icon: '💼', label: 'Jobs' },
    { href: '/news',      icon: '📰', label: 'News' },
    isLoggedIn
      ? { href: dashboardPath(), icon: '👤', label: 'My Account' }
      : { href: '/login',        icon: '🔐', label: 'Login' },
  ];

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="tabbar" aria-label="Quick navigation" role="navigation">
      {tabs.map(({ href, icon, label }) => (
        <Link
          key={href}
          to={href}
          className={`tab-item${isActive(href) ? ' active' : ''}`}
          aria-current={isActive(href) ? 'page' : undefined}
          aria-label={label}
        >
          <span className="tab-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
