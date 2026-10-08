import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';
import PasswordVisibilityToggle from '../components/PasswordVisibilityToggle.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!token) return setMsg({ type: 'error', text: 'This reset link is missing its token.' });
    if (pw.length < 8) return setMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
    if (pw !== confirm) return setMsg({ type: 'error', text: 'Passwords do not match.' });
    setBusy(true);
    try {
      await auth.resetPassword({ token, newPassword: pw });
      setMsg({ type: 'ok', text: 'Password updated. You can now log in.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 460 }}>
        <form className="form-card" onSubmit={submit} noValidate>
          <h2 style={{ fontSize: 18 }}>Create a new password</h2>
          <p className="text-soft">Choose a new password for your Tirur Connect account.</p>
          <div className="form-group"><label htmlFor="pw">New Password</label><div className="password-control"><input id="pw" type={showPassword ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} /></div></div>
          <div className="form-group"><label htmlFor="pw2">Confirm Password</label><div className="password-control"><input id="pw2" type={showConfirmPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /><PasswordVisibilityToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((visible) => !visible)} /></div></div>
          {msg.text && <p className="text-soft" role="alert" style={{ color: msg.type === 'error' ? '#b42318' : 'var(--brand)' }}>{msg.text}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving...' : 'Reset Password'}</button>
          <p className="text-soft center mt-12"><Link to="/login" style={{ color: 'var(--brand)', fontWeight: 700 }}>Back to Login</Link></p>
        </form>
      </div>
    </section>
  );
}
