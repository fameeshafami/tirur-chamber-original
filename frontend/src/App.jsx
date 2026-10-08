import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout.jsx';
import DashGuard from './components/DashGuard.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Directory from './pages/Directory.jsx';
import Jobs from './pages/Jobs.jsx';
import ListBusiness from './pages/ListBusiness.jsx';
import News from './pages/News.jsx';
import Offers from './pages/Offers.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MemberProfile from './pages/MemberProfile.jsx';
import MembershipApplication from './pages/MembershipApplication.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function LegacyRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/\.html$/, '') + search} replace />;
}

const DASHBOARDS = ['admin', 'shop-owner', 'job-seeker', 'chamber-member'];

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/list-business" element={<ListBusiness />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<News />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/chamber-member-profile" element={<MemberProfile />} />
        <Route path="/membership" element={<MembershipApplication />} />

        {DASHBOARDS.map((slug) => (
          <Route
            key={slug}
            path={`/${slug}`}
            element={
              <DashGuard requiredRole={slug.replace('-', '_')}>
                <Dashboard />
              </DashGuard>
            }
          />
        ))}

        <Route
          path="/super-admin"
          element={
            <DashGuard requiredRole="super_admin">
              <Dashboard />
            </DashGuard>
          }
        />

        {/* Old .html links keep working */}
        <Route path="/:page.html" element={<LegacyRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
