import { Link } from 'react-router-dom';
import tirurLogo from '../img/images (10).jpg';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="brand" style={{ marginBottom: 10 }}>
              <img src={tirurLogo} alt="Tirur Connect logo" width={36} height={36} className="brand-logo" />
              <span className="brand-text" style={{ color: '#fff' }}>
                Tirur Connect
                <small style={{ color: 'rgba(255,255,255,0.65)' }}>Community · Directory · Chamber</small>
              </span>
            </div>
            <p>
              The hyperlocal digital hub for Tirur, Kerala — connecting residents,
              businesses, and the Tirur Chamber of Commerce.
            </p>
            {/* <div className="emergency-strip">
              <span>🚨 <b>Police:</b> 100</span>
              <span>🚑 <b>Ambulance:</b> 108</span>
              <span>🔥 <b>Fire:</b> 101</span>
            </div> */}
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/about">About Tirur</Link>
            <Link to="/directory">Business Directory</Link>
            <Link to="/jobs">Careers</Link>
            <Link to="/news">News & Updates</Link>
            <Link to="/offers">Local Offers</Link>
          </div>

          <div className="footer-col">
            <h4>Business</h4>
            <Link to="/list-business">List Your Business</Link>
            <Link to="/membership">Chamber Membership</Link>
            <Link to="/login">Login / Register</Link>
          </div>

          <div className="footer-col">
            <h4>Dashboards</h4>
            <Link to="/shop-owner">Shop Owner</Link>
            <Link to="/job-seeker">Job Seeker</Link>
            <Link to="/chamber-member">Chamber Member</Link>
            <Link to="/admin">Admin</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} osforh. All rights reserved.</span>
          {/* <span>Made with ❤️ for Tirur, Kerala</span> */}
        </div>
      </div>
    </footer>
  );
}
