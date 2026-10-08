import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import tirurLogo from '../img/images (10).jpg';

const NAV_LINKS = [
  { href: '/',          label: 'Home' },
  { href: '/about',     label: 'About' },
  { href: '/directory', label: 'Directory' },
  { href: '/jobs',      label: 'Careers' },
  // { href: '/news',      label: 'News' },
  // { href: '/offers',    label: 'Offers' },
  { href: '/list-business', label: 'List Your Business', badge: 'FREE' },
  { href: '/membership',    label: 'Chamber Membership' },
];

export default function Header() {
  const location            = useLocation();
  const [menuOpen, setMenu] = useState(false);
  const { user, isLoggedIn, logout, dashboardPath, roleLabel } = useAuth();

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // Role-specific dashboard link
  const dashLinks = isLoggedIn ? [
    { href: dashboardPath(), label: `My ${roleLabel()}` },
  ] : [];

  return (
    <>
      <header className="site-header" role="banner">
        <div className="container">
          {/* Brand */}
          <Link to="/" className="brand" aria-label="Tirur Connect — Home">
            <img
              src={tirurLogo}
              alt="Tirur Connect logo"
              width={36}
              height={36}
              className="brand-logo"
            />
            <span className="brand-text">
              Tirur Connect
              <small>Community · Directory · Chamber</small>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="nav-desktop" aria-label="Main navigation">
            <ul role="list">
              {NAV_LINKS.map(({ href, label, badge }) => (
                <li key={href}>
                  <Link to={href} className={isActive(href) ? 'active' : ''}>
                    {label}
                    {badge && <span className="nav-badge">{badge}</span>}
                  </Link>
                </li>
              ))}
              {dashLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link to={href} className={isActive(href) ? 'active' : ''}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Header actions */}
          <div className="header-actions">
            {isLoggedIn ? (
              <>
                <Link
                  to={dashboardPath()}
                  className="role-pill hide-mobile"
                  title={`Go to ${roleLabel()} dashboard`}
                  aria-label={`${user.name} — ${roleLabel()}`}
                >
                  <span className="role-avatar" aria-hidden="true">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hide-mobile">{user.name}</span>
                </Link>
                <button className="btn btn-outline btn-sm" onClick={logout} aria-label="Log out">
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
            )}

            <button
              className="hamburger"
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide menu */}
      <div
        id="mobile-menu"
        className={`mobile-overlay${menuOpen ? ' open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setMenu(false); }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <nav className="mobile-panel">
          <div className="mobile-panel-header">
            <Link to="/" className="brand" onClick={() => setMenu(false)}>
              <img src={tirurLogo} alt="" width={28} height={28} className="brand-logo" />
              <span className="brand-text" style={{ fontSize: 14 }}>Tirur Connect</span>
            </Link>
            <button
              className="mobile-panel-close"
              onClick={() => setMenu(false)}
              aria-label="Close menu"
            >✕</button>
          </div>

          <div className="mobile-nav">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={isActive(href) ? 'active' : ''}
                onClick={() => setMenu(false)}
              >
                {label}
              </Link>
            ))}
            {dashLinks.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={isActive(href) ? 'active' : ''}
                onClick={() => setMenu(false)}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="mobile-panel-footer">
            {isLoggedIn ? (
              <>
                <div className="role-pill" style={{ justifyContent: 'center' }}>
                  <span className="role-avatar">{user.name.charAt(0).toUpperCase()}</span>
                  {user.name} · {roleLabel()}
                </div>
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => { logout(); setMenu(false); }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-block" onClick={() => setMenu(false)}>
                Login / Register
              </Link>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
