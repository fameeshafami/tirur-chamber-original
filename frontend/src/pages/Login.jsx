import { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { auth } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import tirurLogo from '../img/images (10).jpg';

const ROLE_PATH = {
  super_admin: '/super-admin',
  admin: '/admin',
  shop_owner: '/shop-owner',
  job_seeker: '/job-seeker',
  chamber_member: '/chamber-member',
};

function Feedback({ error, notice }) {
  if (!error && !notice) return null;
  return (
    <p className={`auth-feedback${error ? ' is-error' : ' is-notice'}`} role={error ? 'alert' : 'status'} aria-live="polite">
      {error || notice}
    </p>
  );
}

function PasswordVisibilityIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!visible && <path d="m4 4 16 16" />}
    </svg>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const preRole = ['shop_owner', 'job_seeker'].includes(params.get('register')) ? params.get('register') : null;
  const [mode, setMode] = useState(preRole ? 'register' : hash === '#forgot' ? 'forgot' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    identifier: '', password: '', name: '', email: '', phone: '', role: preRole || 'shop_owner',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const switchMode = (next, role) => {
    setMode(next); setError(''); setNotice('');
    if (role) setForm((f) => ({ ...f, role }));
  };

  async function run(task) {
    setError(''); setNotice(''); setBusy(true);
    try { await task(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const finishLogin = (data) => {
    login(data.token, data.user);
    navigate(ROLE_PATH[data.user.role] || '/', { replace: true });
  };

  const submitLogin = (e) => {
    e.preventDefault();
    const id = form.identifier.trim();
    if (!id || !form.password) return setError('Please enter your username or email and password.');
    run(async () => {
      const data = await auth.login({ email: id, username: id, usernameOrEmail: id, password: form.password });
      if (!data.token || !data.user?.role) throw new Error('Unable to sign in. Please try again.');
      finishLogin(data);
    });
  };

  const submitRegister = (e) => {
    e.preventDefault();
    const { name, email, phone, password, role } = form;
    if (!name.trim() || !email.trim() || !phone.trim() || !password) return setError('Please complete all fields.');
    run(async () => {
      const data = await auth.register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, role });
      if (data.token && data.user?.role) return finishLogin(data);
      switchMode('login');
      setNotice(data.message || 'Account created. Please log in.');
    });
  };

  const submitForgot = (e) => {
    e.preventDefault();
    if (!form.email.trim()) return setError('Please enter your email.');
    run(async () => {
      const data = await auth.forgotPassword({ email: form.email.trim() });
      setNotice(data.message || 'If that account exists, a reset link has been created.');
    });
  };

  return (
    <section className="section auth-section">
      <div className="container auth-container">
        <div className="auth-panel">
          <div className="auth-visual" aria-hidden="true">
            <img src="/images/images%20(10).jpg" alt="" />
            <div className="auth-visual-copy">
              <span>COMMUNITY · BUSINESS · OPPORTUNITY</span>
              {/* <p>Local connections.<br />Shared growth.</p> */}
            </div>
          </div>
          <div className="auth-content">
            <Link className="auth-brand" to="/" aria-label="Tirur Connect home">
              <img src={tirurLogo} alt="" />
              <span>Tirur Connect</span>
            </Link>
          {mode === 'login' && (
            <form className="auth-form" onSubmit={submitLogin} noValidate>
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-description">Sign in to your Tirur Connect account.</p>
              <div className="form-group">
                <label htmlFor="identifier">Username or Email</label>
                <input className="form-control" id="identifier" value={form.identifier} onChange={set('identifier')} autoComplete="username" placeholder="Enter your username or email" required />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-control">
                  <input className="form-control" id="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="current-password" placeholder="Enter your password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>
              </div>
              <Feedback error={error} notice={notice} />
              <button className="btn btn-primary btn-block auth-submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
              <p className="auth-secondary-action">
                <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
              </p>
              <p className="auth-register-prompt">
                New to Tirur Connect?<br />
                <button type="button" className="auth-link" onClick={() => switchMode('register', 'shop_owner')}>Create a Shop Owner account</button>
                <span className="auth-or"> or </span>
                <button type="button" className="auth-link" onClick={() => switchMode('register', 'job_seeker')}>Job Seeker account</button>.
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form className="auth-form" onSubmit={submitRegister} noValidate>
              <h1 className="auth-title">Create your account</h1>
              <div className="form-group"><label htmlFor="name">Full Name</label><input className="form-control" id="name" value={form.name} onChange={set('name')} autoComplete="name" required /></div>
              <div className="form-group"><label htmlFor="email">Email</label><input className="form-control" id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
              <div className="form-group"><label htmlFor="phone">Phone</label><input className="form-control" id="phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" required /></div>
              <div className="form-group"><label htmlFor="reg-password">Password</label><div className="password-control"><input className="form-control" id="reg-password" type={showPassword ? 'text' : 'password'} minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><PasswordVisibilityIcon visible={showPassword} /></button></div></div>
              <div className="form-group">
                <label htmlFor="role">Account Type</label>
                <select className="form-control" id="role" value={form.role} onChange={set('role')}>
                  <option value="shop_owner">Shop Owner</option>
                  <option value="job_seeker">Job Seeker</option>
                </select>
              </div>
              <Feedback error={error} notice={notice} />
              <button className="btn btn-primary btn-block auth-submit" disabled={busy}>{busy ? 'Creating account...' : 'Create Account'}</button>
              <p className="auth-register-prompt">
                Already registered? <button type="button" className="auth-link" onClick={() => switchMode('login')}>Sign in</button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="auth-form" onSubmit={submitForgot} noValidate>
              <h1 className="auth-title">Reset your password</h1>
              <p className="auth-description">Enter your account email to create a password reset link.</p>
              <div className="form-group"><label htmlFor="forgot-email">Email</label><input className="form-control" id="forgot-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
              <Feedback error={error} notice={notice} />
              <button className="btn btn-primary btn-block auth-submit" disabled={busy}>{busy ? 'Sending...' : 'Send Reset Link'}</button>
              <p className="auth-secondary-action"><button type="button" className="auth-link" onClick={() => switchMode('login')}>Back to sign in</button></p>
            </form>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
