import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard.jsx';
import ChamberMemberDashboard from './ChamberMemberDashboard.jsx';
import JobSeekerDashboard from './JobSeekerDashboard.jsx';
import ShopOwnerDashboard from './ShopOwnerDashboard.jsx';

export default function Dashboard() {
  const { user, roleLabel, logout, isAdmin, isChamberMember, isJobSeeker, isShopOwner } = useAuth();

  if (isAdmin) return <AdminDashboard />;
  if (isChamberMember) return <ChamberMemberDashboard />;
  if (isJobSeeker) return <JobSeekerDashboard />;
  if (isShopOwner) return <ShopOwnerDashboard />;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="form-card">
          <h2 style={{ fontSize: 18 }}>{roleLabel()} dashboard</h2>
          <p className="text-soft">Signed in as {user?.name || user?.email}. This dashboard is still being rebuilt in React.</p>
          <button className="btn btn-primary" onClick={logout}>Logout</button>
        </div>
      </div>
    </section>
  );
}
