import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useToast } from '../components/Toast.jsx';
import MembershipIdCardModal from '../components/MembershipIdCardModal.jsx';

const TABS = [
  ['overview', '📊 Overview'],
  ['membership', '🎖️ Membership'],
  ['profile', '🏪 Business profile'],
  ['qr', '▦ QR identity'],
  ['members', '👥 All members'],
  ['documents', '📄 Candidate CVs'],
  ['notifications', '🔔 Notifications'],
  ['settings', '⚙️ Settings'],
];

const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function EmptyRow({ columns, children }) {
  return <tr><td colSpan={columns} className="text-soft">{children}</td></tr>;
}

function Table({ headings, children }) {
  return (
    <div className="table-wrap admin-table-wrap">
      <table className="data-table">
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function cvBlob(cv) {
  const encoded = String(cv?.file || '').replace(/^data:[^,]+,/, '');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: cv.fileType || 'application/octet-stream' });
}

export default function ChamberMemberDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [qr, setQr] = useState(null);
  const [members, setMembers] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [saving, setSaving] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const [profileResult, membershipResult, qrResult, membersResult, notificationResult] = await Promise.all([
        apiRequest('/chamber-member/profile'),
        apiRequest('/chamber-member/membership'),
        apiRequest('/chamber-member/qr'),
        apiRequest('/chamber-member/all-active-members'),
        apiRequest('/chamber-member/notifications'),
      ]);
      setProfile(profileResult.user);
      setMembership(membershipResult.membership);
      setQr(qrResult.qr);
      setMembers(membersResult.members || []);
      setNotifications(notificationResult.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load Chamber Member information.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'documents') return undefined;
    let active = true;
    setResumeLoading(true);
    setResumeError('');
    apiRequest('/resumes')
      .then((result) => { if (active) setResumes(result.data || []); })
      .catch((requestError) => { if (active) setResumeError(requestError.message || 'Resume access is unavailable.'); })
      .finally(() => { if (active) setResumeLoading(false); });
    return () => { active = false; };
  }, [tab]);

  async function updateMembership(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await apiRequest('/chamber-member/membership', { method: 'PATCH', body: JSON.stringify(body) });
      setMembership(result.membership);
      toast('Business profile updated.', 'success');
    } catch (requestError) {
      toast(requestError.message || 'Unable to update business profile.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function updateAccount(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await apiRequest('/chamber-member/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setProfile(result.user);
      toast('Account settings saved.', 'success');
    } catch (requestError) {
      toast(requestError.message || 'Unable to save account settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function markRead(id) {
    try {
      await apiRequest(`/chamber-member/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((notification) => notification._id === id ? { ...notification, readAt: new Date().toISOString() } : notification));
    } catch (requestError) {
      toast(requestError.message || 'Unable to mark notification as read.', 'error');
    }
  }

  async function markAllRead() {
    try {
      await apiRequest('/chamber-member/notifications/read-all', { method: 'PATCH' });
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() })));
    } catch (requestError) {
      toast(requestError.message || 'Unable to update notifications.', 'error');
    }
  }

  async function openCv(path) {
    const preview = window.open('', '_blank');
    if (!preview) {
      toast('Please allow pop-ups to view the CV.', 'error');
      return;
    }
    preview.document.write('<p style="font-family:sans-serif;padding:24px">Loading CV…</p>');
    try {
      const result = await apiRequest(path);
      const url = URL.createObjectURL(cvBlob(result.cv));
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      preview.close();
      toast(requestError.message || 'Unable to load CV.', 'error');
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const profileUrl = qr?.publicId
    ? `/chamber-member-profile?publicId=${encodeURIComponent(qr.publicId)}`
    : '';

  return (
    <section className="section">
      <div className="container chamber-dashboard">
        <header className="chamber-dashboard-heading">
          <div><h1>Chamber Member Dashboard</h1><p className="text-soft">Membership, verified QR identity, and Chamber resources.</p></div>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadDashboard} disabled={loading}>↻ Refresh</button>
        </header>

        <nav className="chamber-dashboard-tabs" aria-label="Chamber dashboard sections">
          {TABS.map(([key, label]) => <button key={key} type="button" className={`dash-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}>{label}{key === 'notifications' && unreadCount > 0 ? ` (${unreadCount})` : ''}</button>)}
        </nav>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {loading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading Chamber dashboard" /></div> : (
          <>
            {tab === 'overview' && (
              <div className="chamber-overview-grid">
                <div className="chamber-stat"><span>Membership number</span><strong>{membership?.membershipNumber || 'Pending'}</strong></div>
                <div className="chamber-stat"><span>Membership status</span><strong>{membership?.status || 'No membership'}</strong></div>
                <div className="chamber-stat"><span>QR identity</span><strong>{qr ? 'Active' : 'Unavailable'}</strong></div>
                <div className="chamber-stat"><span>Unread notifications</span><strong>{unreadCount}</strong></div>
                <section className="chamber-panel chamber-overview-summary">
                  <h2>Membership overview</h2>
                  {membership ? <p><strong>{membership.businessName}</strong><br /><span className="text-soft">Owner: {membership.ownerName || profile?.name || '—'} · Valid until {dateLabel(membership.membershipExpiryDate)}</span></p> : <p className="text-soft">No Chamber membership record is available.</p>}
                  <div className="admin-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('membership')}>View membership</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setIdCardOpen(true)} disabled={!qr || membership?.status !== 'active'}>Open ID card</button></div>
                </section>
              </div>
            )}

            {tab === 'membership' && (
              <section className="chamber-panel">
                <h2>My membership</h2>
                {!membership ? <p className="text-soft">No membership record found.</p> : (
                  <dl className="chamber-details">
                    {[
                      ['Business', membership.businessName], ['Membership number', membership.membershipNumber],
                      ['Plan', membership.plan], ['Status', membership.status],
                      ['Start date', dateLabel(membership.membershipStartDate)], ['Expiry date', dateLabel(membership.membershipExpiryDate)],
                    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
                  </dl>
                )}
              </section>
            )}

            {tab === 'profile' && (
              <form className="chamber-panel chamber-form" onSubmit={updateMembership}>
                <h2>Business profile</h2>
                <div className="admin-field-row"><label>Business name<input name="businessName" defaultValue={membership?.businessName || ''} required /></label><label>Owner name<input name="ownerName" defaultValue={membership?.ownerName || ''} /></label></div>
                <div className="admin-field-row"><label>Phone<input name="phone" defaultValue={membership?.phone || ''} /></label><label>Email<input name="email" type="email" defaultValue={membership?.email || ''} /></label></div>
                <div className="admin-field-row"><label>Category<input name="category" defaultValue={membership?.category || ''} /></label><label>Website<input name="website" type="url" defaultValue={membership?.website || ''} /></label></div>
                <label>Address<textarea name="address" defaultValue={membership?.address || ''} /></label>
                <label>Description<textarea name="description" defaultValue={membership?.description || ''} /></label>
                <label>Logo URL<input name="logo" type="url" defaultValue={membership?.logo || ''} /></label>
                <button className="btn btn-primary" type="submit" disabled={saving}>Save business profile</button>
              </form>
            )}

            {tab === 'qr' && (
              <section className="chamber-panel"><h2>Verified QR identity</h2>
                {qr && membership?.status === 'active' ? <>
                  <div className="chamber-qr-card"><img src={qr.imageDataUrl} alt="Chamber membership QR code" /><div><strong>{membership.businessName}</strong><p>{membership.membershipNumber || qr.membershipNumber || 'Active Member'}</p><p className="text-soft">Valid until {dateLabel(membership.membershipExpiryDate)}</p></div></div>
                  <div className="admin-actions chamber-qr-actions"><button className="btn btn-primary btn-sm" type="button" onClick={() => setIdCardOpen(true)}>Open ID card</button><Link className="btn btn-outline btn-sm" to={profileUrl}>View public verification</Link><a className="btn btn-outline btn-sm" href={qr.imageDataUrl} download={`${qr.membershipNumber || 'chamber-member'}-qr.png`}>Download QR</a></div>
                </> : <div className="empty-state"><div className="empty-icon">▦</div><h3>QR identity unavailable</h3><p>Your QR profile appears after the Chamber approves your membership.</p></div>}
              </section>
            )}

            {tab === 'members' && (
              <section className="chamber-panel"><h2>Chamber QR Directory</h2>
                <div className="chamber-member-grid">{members.map((member) => <article className="chamber-member-card" key={member._id}>
                  <div className="chamber-member-identity">{member.logo ? <img src={member.logo} alt="" /> : <span aria-hidden="true">🏪</span>}<div><h3>{member.businessName}</h3><p>{member.category || 'Business'}</p></div></div>
                  <p><strong>{member.ownerName || 'Member'}</strong>{member.phone ? ` · ${member.phone}` : ''}</p>
                  <p className="text-soft">{member.membershipNumber || 'Active member'} · Until {dateLabel(member.membershipExpiryDate)}</p>
                  {member.imageDataUrl ? <img src={member.imageDataUrl} alt={`${member.businessName} QR code`} style={{ width: 120, height: 120, objectFit: 'contain', margin: '8px 0', borderRadius: 8 }} /> : <p className="text-soft">QR unavailable</p>}
                  <div className="admin-actions"><a className="btn btn-outline btn-sm" href={member.qrCode ? `/chamber-member-profile?publicId=${encodeURIComponent(member.qrCode)}` : '#'} target="_blank" rel="noreferrer">View verification</a>{member.imageDataUrl && <a className="btn btn-outline btn-sm" href={member.imageDataUrl} download={`${member.membershipNumber || member.businessName}-qr.png`}>Download QR</a>}</div>
                </article>)}{!members.length && <p className="text-soft">No active Chamber members found.</p>}</div>
              </section>
            )}

            {tab === 'documents' && (
              <section className="chamber-panel"><h2>Candidate CVs</h2>
                {resumeLoading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading candidate CVs" /></div> : resumeError ? <div className="alert alert-warning" role="alert">{resumeError}</div> : <Table headings={['Candidate', 'Location', 'Education', 'Experience', 'Skills', 'CV']}>
                  {resumes.map((resume) => <tr key={resume.id}><td>{resume.name}<small>{resume.email} · {resume.phone}</small></td><td>{resume.location || '—'}</td><td>{resume.education || '—'}</td><td>{resume.experience || '—'}</td><td>{(resume.skills || []).join(', ') || '—'}</td><td><button type="button" className="btn btn-outline btn-sm" onClick={() => openCv(`/resumes/${resume.id}/cv`)}>{resume.cv?.fileName || 'View CV'}</button></td></tr>)}
                  {!resumes.length && <EmptyRow columns={6}>No candidate CVs found.</EmptyRow>}
                </Table>}
              </section>
            )}

            {tab === 'notifications' && (
              <section className="chamber-panel"><div className="chamber-panel-heading"><h2>Notifications</h2>{unreadCount > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all read</button>}</div>
                <div className="chamber-notifications">{notifications.map((notification) => <article className={`chamber-notification${notification.readAt ? ' is-read' : ''}`} key={notification._id}><div><strong>{notification.message || notification.type}</strong><small>{dateLabel(notification.createdAt)}</small></div>{!notification.readAt && <button type="button" className="btn btn-outline btn-sm" onClick={() => markRead(notification._id)}>Mark read</button>}</article>)}{!notifications.length && <p className="text-soft">No notifications yet.</p>}</div>
              </section>
            )}

            {tab === 'settings' && (
              <form className="chamber-panel chamber-form" onSubmit={updateAccount}>
                <h2>Account settings</h2>
                <div className="admin-field-row"><label>Name<input name="name" defaultValue={profile?.name || ''} required /></label><label>Phone<input name="phone" defaultValue={profile?.phone || ''} /></label></div>
                <label>Email<input name="email" type="email" defaultValue={profile?.email || ''} required /></label>
                <button className="btn btn-primary" type="submit" disabled={saving}>Save account settings</button>
              </form>
            )}
          </>
        )}
        {idCardOpen && qr && membership?.status === 'active' && <MembershipIdCardModal membership={membership} qr={qr} onClose={() => setIdCardOpen(false)} />}
      </div>
    </section>
  );
}
