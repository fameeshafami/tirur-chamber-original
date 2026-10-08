import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useToast } from '../components/Toast.jsx';

const TABS = [
  ['overview', '📊 Overview'], ['profile', '👤 Profile'], ['business', '🏪 Business'],
  ['jobs', '💼 Jobs'], ['applications', '📝 Applicants'], ['resumes', '📄 Candidate CVs'],
  ['membership', '🎖️ Chamber'], ['notifications', '🔔 Alerts'],
];
const emptyJob = { title: '', description: '', location: '', employmentType: 'Full-time', category: '', requirements: '', skills: '', salary: '', quantity: 1, experience: '', education: '', applicationMethod: 'tirur_connect', applicationLink: '', closingDate: '' };

function Table({ headings, children }) {
  return <div className="table-wrap admin-table-wrap"><table className="data-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function EmptyRow({ columns, children }) {
  return <tr><td colSpan={columns} className="text-soft">{children}</td></tr>;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

function openFile(cv) {
  const encoded = String(cv?.file || '').replace(/^data:[^,]+,/, '');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: cv.fileType || 'application/octet-stream' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Payment checkout is unavailable.'));
    document.head.appendChild(script);
  });
}

export default function ShopOwnerDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [membership, setMembership] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [resumeError, setResumeError] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [jobDraft, setJobDraft] = useState(emptyJob);
  const [editingJob, setEditingJob] = useState('');
  const [membershipPlan, setMembershipPlan] = useState('Silver - ₹2,500/yr');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [profileResult, businessResult, dashboardResult, jobsResult, applicationsResult, membershipResult, notificationsResult] = await Promise.all([
        apiRequest('/shop-owner/profile'), apiRequest('/shop-owner/business'), apiRequest('/shop-owner/dashboard'),
        apiRequest('/shop-owner/jobs'), apiRequest('/shop-owner/applications'), apiRequest('/shop-owner/membership'),
        apiRequest('/shop-owner/notifications'),
      ]);
      setProfile(profileResult.user);
      setBusiness(businessResult.business || null);
      setSummary(dashboardResult);
      setJobs(jobsResult.data || []);
      setApplications(applicationsResult.data || []);
      setMembership(membershipResult.membership || null);
      setNotifications(notificationsResult.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the Shop Owner dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData().catch(() => {}); }, []);

  useEffect(() => {
    if (tab !== 'resumes') return undefined;
    let active = true;
    setResumeLoading(true);
    setResumeError('');
    apiRequest('/resumes')
      .then((result) => { if (active) setResumes(result.data || []); })
      .catch((requestError) => { if (active) setResumeError(requestError.message || 'Candidate CV access is unavailable.'); })
      .finally(() => { if (active) setResumeLoading(false); });
    return () => { active = false; };
  }, [tab]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await apiRequest('/shop-owner/profile', { method: 'PATCH', body: JSON.stringify(body) });
      setProfile(result.user);
      toast('Profile updated.', 'success');
    } catch (requestError) {
      toast(requestError.message || 'Unable to update profile.', 'error');
    } finally { setSaving(false); }
  }

  async function saveBusiness(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = business?._id
        ? await apiRequest(`/shop-owner/business/${business._id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiRequest('/shop-owner/business', { method: 'POST', body: JSON.stringify(body) });
      setBusiness(result.business);
      toast(business?._id ? 'Business profile updated.' : 'Business profile created.', 'success');
      await loadData();
    } catch (requestError) {
      toast(requestError.message || 'Unable to save business profile.', 'error');
    } finally { setSaving(false); }
  }

  async function saveJob(event) {
    event.preventDefault();
    setSaving(true);
    const body = {
      ...jobDraft,
      quantity: Number(jobDraft.quantity) || 1,
      skills: jobDraft.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      closingDate: jobDraft.closingDate || undefined,
    };
    delete body._id;
    try {
      if (editingJob) await apiRequest(`/shop-owner/jobs/${editingJob}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await apiRequest('/shop-owner/jobs', { method: 'POST', body: JSON.stringify(body) });
      toast(editingJob ? 'Job updated.' : 'Job posted.', 'success');
      setEditingJob('');
      setJobDraft(emptyJob);
      await loadData();
    } catch (requestError) {
      toast(requestError.message || 'Unable to save job.', 'error');
    } finally { setSaving(false); }
  }

  async function changeApplicationStatus(id, status) {
    try {
      await apiRequest(`/shop-owner/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setApplications((current) => current.map((application) => application._id === id ? { ...application, status } : application));
      toast('Application status updated.', 'success');
    } catch (requestError) {
      toast(requestError.message || 'Unable to update application.', 'error');
    }
  }

  async function createMembership(event) {
    event.preventDefault();
    if (!business) {
      setTab('business');
      toast('Create a business profile before applying.', 'error');
      return;
    }
    setSaving(true);
    try {
      const orderResult = await apiRequest('/shop-owner/membership/payment/order', { method: 'POST', body: JSON.stringify({ plan: membershipPlan }) });
      if (!orderResult.mock) {
        await loadRazorpay();
        const payment = await new Promise((resolve, reject) => {
          const checkout = new window.Razorpay({
            key: orderResult.keyId,
            amount: orderResult.order.amount,
            currency: orderResult.order.currency,
            name: 'Tirur Chamber of Commerce',
            description: `${membershipPlan} membership application`,
            prefill: { name: profile?.name, email: profile?.email, contact: profile?.phone },
            theme: { color: '#7c7ebd' },
            handler: resolve,
            modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
          });
          checkout.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
          checkout.open();
        });
        await apiRequest('/shop-owner/membership/payment/verify', { method: 'POST', body: JSON.stringify(payment) });
      }
      const result = await apiRequest('/shop-owner/membership', { method: 'POST', body: JSON.stringify({ plan: membershipPlan, paymentOrderId: orderResult.order.id }) });
      setMembership(result.membership);
      toast('Membership application submitted for review.', 'success');
      await loadData();
    } catch (requestError) {
      toast(requestError.message || 'Unable to submit membership application.', 'error');
    } finally { setSaving(false); }
  }

  async function markRead(id) {
    try {
      await apiRequest(`/shop-owner/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (requestError) { toast(requestError.message || 'Unable to mark notification as read.', 'error'); }
  }

  async function markAllRead() {
    try {
      await apiRequest('/shop-owner/notifications/read-all', { method: 'PATCH' });
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (requestError) { toast(requestError.message || 'Unable to update notifications.', 'error'); }
  }

  async function viewCandidateCv(id) {
    const preview = window.open('', '_blank');
    if (!preview) { toast('Please allow pop-ups to view candidate CVs.', 'error'); return; }
    try {
      const result = await apiRequest(`/shop-owner/applications/${id}/cv`);
      const encoded = String(result.cv.file || '').replace(/^data:[^,]+,/, '');
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes], { type: result.cv.fileType || 'application/octet-stream' }));
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      preview.close();
      toast(requestError.message || 'Unable to load candidate CV.', 'error');
    }
  }

  const profileFields = ['name', 'email', 'phone'];
  const statCards = [
    ['Businesses', summary?.businesses ?? 0], ['Jobs', summary?.jobs?.total ?? jobs.length],
    ['Applications', summary?.applications ?? applications.length], ['Unread alerts', summary?.notifications ?? notifications.filter((item) => !item.readAt).length],
  ];

  return (
    <section className="section"><div className="container chamber-dashboard shop-owner-dashboard">
      <header className="chamber-dashboard-heading"><div><h1>Shop Owner Dashboard</h1><p className="text-soft">Manage your profile, business, jobs, applicants, and membership.</p></div><button className="btn btn-outline refresh-btn" type="button" onClick={loadData} disabled={loading}><span aria-hidden="true">↻</span><span>{loading ? 'Refreshing...' : 'Refresh'}</span></button></header>
      <nav className="chamber-dashboard-tabs" aria-label="Shop Owner dashboard sections">{TABS.map(([key, label]) => <button key={key} type="button" className={`dash-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>)}</nav>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading Shop Owner dashboard" /></div> : <>
        {tab === 'overview' && <div className="chamber-overview-grid">{statCards.map(([label, value]) => <div className="chamber-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}<section className="chamber-panel chamber-overview-summary"><h2>Quick summary</h2><p><strong>{business?.name || 'Business profile not set up'}</strong>{business && <><br/><span className="text-soft">{business.category} · {business.status}</span></>}</p><div className="admin-actions"><button className="btn btn-outline btn-sm" type="button" onClick={() => setTab('business')}>{business ? 'Edit business' : 'Create business profile'}</button><button className="btn btn-outline btn-sm" type="button" onClick={() => setTab('membership')}>Chamber membership</button></div></section></div>}

        {tab === 'profile' && <form className="chamber-panel chamber-form" onSubmit={saveProfile}><h2>Profile</h2><div className="admin-field-row"><label>Name<input name="name" defaultValue={profile?.name || ''} required /></label><label>Email<input name="email" type="email" defaultValue={profile?.email || ''} required /></label></div><label>Phone<input name="phone" defaultValue={profile?.phone || ''} /></label><button className="btn btn-primary" disabled={saving}>Save profile</button></form>}

        {tab === 'business' && <form className="chamber-panel chamber-form" onSubmit={saveBusiness}><h2>Business profile</h2><div className="admin-field-row"><label>Business name<input name="name" defaultValue={business?.name || ''} required /></label><label>Category<input name="category" defaultValue={business?.category || ''} required /></label></div><div className="admin-field-row"><label>Phone<input name="phone" defaultValue={business?.phone || ''} required /></label><label>Email<input name="email" type="email" defaultValue={business?.email || ''} /></label></div><label>Description<textarea name="description" defaultValue={business?.description || ''} required /></label><div className="admin-field-row"><label>Address<input name="address" defaultValue={business?.address || ''} required /></label><label>Area / locality<input name="location" defaultValue={business?.location || ''} /></label></div><div className="admin-field-row"><label>Website<input name="website" type="url" defaultValue={business?.website || ''} /></label><label>Hours<input name="hours" defaultValue={business?.hours || ''} /></label></div><button className="btn btn-primary" disabled={saving}>Save business</button></form>}

        {tab === 'jobs' && <div className="admin-content-grid"><form className="form-card admin-editor" onSubmit={saveJob}><h2>{editingJob ? 'Edit job' : 'Post a job'}</h2><label>Title<input required value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} /></label><div className="admin-field-row"><label>Location<input required value={jobDraft.location} onChange={(event) => setJobDraft({ ...jobDraft, location: event.target.value })} /></label><label>Type<select value={jobDraft.employmentType} onChange={(event) => setJobDraft({ ...jobDraft, employmentType: event.target.value })}>{['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => <option key={type}>{type}</option>)}</select></label></div><label>Description<textarea required value={jobDraft.description} onChange={(event) => setJobDraft({ ...jobDraft, description: event.target.value })} /></label><label>Requirements<textarea value={jobDraft.requirements} onChange={(event) => setJobDraft({ ...jobDraft, requirements: event.target.value })} /></label><div className="admin-field-row"><label>Category<input value={jobDraft.category} onChange={(event) => setJobDraft({ ...jobDraft, category: event.target.value })} /></label><label>Salary<input value={jobDraft.salary} onChange={(event) => setJobDraft({ ...jobDraft, salary: event.target.value })} /></label></div><div className="admin-field-row"><label>Skills<input value={jobDraft.skills} onChange={(event) => setJobDraft({ ...jobDraft, skills: event.target.value })} /></label><label>Vacancies<input type="number" min="1" value={jobDraft.quantity} onChange={(event) => setJobDraft({ ...jobDraft, quantity: event.target.value })} /></label></div><div className="admin-field-row"><label>Experience<input value={jobDraft.experience} onChange={(event) => setJobDraft({ ...jobDraft, experience: event.target.value })} /></label><label>Education<input value={jobDraft.education} onChange={(event) => setJobDraft({ ...jobDraft, education: event.target.value })} /></label></div><label>Application method<select value={jobDraft.applicationMethod} onChange={(event) => setJobDraft({ ...jobDraft, applicationMethod: event.target.value })}><option value="tirur_connect">Apply through Tirur Connect</option><option value="external">External application</option></select></label>{jobDraft.applicationMethod === 'external' && <label>Application URL<input required type="url" value={jobDraft.applicationLink} onChange={(event) => setJobDraft({ ...jobDraft, applicationLink: event.target.value })} /></label>}<label>Closing date<input type="date" value={jobDraft.closingDate} onChange={(event) => setJobDraft({ ...jobDraft, closingDate: event.target.value })} /></label><div className="admin-actions"><button className="btn btn-primary" disabled={saving}>{editingJob ? 'Update job' : 'Publish job'}</button>{editingJob && <button type="button" className="btn btn-outline" onClick={() => { setEditingJob(''); setJobDraft(emptyJob); }}>Cancel edit</button>}</div></form><section className="admin-section"><h2>My jobs</h2><div className="jobseeker-job-list">{jobs.map((job) => <article className="jobseeker-job" key={job._id}><div><h3>{job.title}</h3><p>{job.location} · {job.employmentType} · {job.status}</p></div><div className="admin-actions">{job.status === 'published' && <button type="button" className="btn btn-outline btn-sm" onClick={() => apiRequest(`/shop-owner/jobs/${job._id}/close`, { method: 'PATCH' }).then(loadData).catch((error) => toast(error.message, 'error'))}>Close</button>}{job.status !== 'closed' && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingJob(job._id); setJobDraft({ ...emptyJob, ...job, skills: (job.skills || []).join(', '), closingDate: job.closingDate ? job.closingDate.slice(0, 10) : '' }); }}>Edit</button>}<button type="button" className="btn btn-danger btn-sm" onClick={() => apiRequest(`/shop-owner/jobs/${job._id}`, { method: 'DELETE' }).then(loadData).catch((error) => toast(error.message, 'error'))}>Delete</button></div></article>)}{!jobs.length && <p className="text-soft">No jobs posted yet.</p>}</div></section></div>}

        {tab === 'applications' && <section className="chamber-panel"><h2>Applicants</h2><Table headings={['Candidate', 'Job', 'Education', 'Experience', 'Status', 'Actions']}>{applications.map((application) => <tr key={application._id}><td>{application.jobSeeker?.name || 'Candidate'}<small>{application.jobSeeker?.email || application.jobSeeker?.phone || ''}</small></td><td>{application.job?.title || '—'}</td><td>{application.education || '—'}</td><td>{application.experience || '—'}</td><td>{application.status}</td><td className="admin-actions"><select aria-label="Application status" value={application.status} onChange={(event) => changeApplicationStatus(application._id, event.target.value)}>{['submitted', 'eligible', 'shortlisted', 'not_eligible', 'rejected'].map((status) => <option key={status}>{status}</option>)}</select><button type="button" className="btn btn-outline btn-sm" onClick={() => viewCandidateCv(application._id)} disabled={!membership || membership.status !== 'active'}>View CV</button></td></tr>)}{!applications.length && <EmptyRow columns={6}>No applications yet.</EmptyRow>}</Table></section>}

        {tab === 'resumes' && <section className="chamber-panel"><h2>Candidate CVs</h2>{resumeLoading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading candidate CVs" /></div> : resumeError ? <div className="alert alert-warning" role="alert">{resumeError} An active, paid Chamber Membership is required.</div> : <Table headings={['Candidate', 'Location', 'Education', 'Experience', 'Skills', 'CV']}>
          {resumes.map((resume) => <tr key={resume.id}><td>{resume.name}<small>{resume.email} · {resume.phone}</small></td><td>{resume.location || '—'}</td><td>{resume.education || '—'}</td><td>{resume.experience || '—'}</td><td>{(resume.skills || []).join(', ') || '—'}</td><td><button type="button" className="btn btn-outline btn-sm" onClick={() => viewCandidateCv(resume.id)}>{resume.cv?.fileName || 'View CV'}</button></td></tr>)}
          {!resumes.length && <EmptyRow columns={6}>No candidate CVs found.</EmptyRow>}
        </Table>}</section>}

        {tab === 'membership' && <section className="chamber-panel"><h2>Chamber membership</h2>{membership ? <><dl className="chamber-details">{[['Business', membership.businessName], ['Plan', membership.plan], ['Status', membership.status], ['Expires', dateLabel(membership.membershipExpiryDate)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>{membership.status === 'active' && <p className="text-soft" style={{ marginTop: 12 }}>Your active membership enables verified QR identity and candidate CV access.</p>}</> : <><p className="text-soft">Apply for paid Chamber membership after creating your business profile.</p><form className="chamber-form" onSubmit={createMembership}><label>Membership plan<select value={membershipPlan} onChange={(event) => setMembershipPlan(event.target.value)}><option value="Silver - ₹2,500/yr">Silver · ₹2,500/year</option><option value="Gold - ₹5,000/yr">Gold · ₹5,000/year</option><option value="Platinum - ₹10,000/yr">Platinum · ₹10,000/year</option></select></label><p className="text-soft">Payment will be collected securely before your membership application is sent for review.</p><button className="btn btn-primary" disabled={saving || !business}>{saving ? 'Submitting…' : 'Continue to payment'}</button></form></>}</section>}

        {tab === 'notifications' && <section className="chamber-panel"><div className="chamber-panel-heading"><h2>Notifications</h2>{notifications.some((item) => !item.readAt) && <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all read</button>}</div><div className="chamber-notifications">{notifications.map((notification) => <article className={`chamber-notification${notification.readAt ? ' is-read' : ''}`} key={notification._id}><div><strong>{notification.message || notification.type}</strong><small>{dateLabel(notification.createdAt)}</small></div>{!notification.readAt && <button type="button" className="btn btn-outline btn-sm" onClick={() => markRead(notification._id)}>Mark read</button>}</article>)}{!notifications.length && <p className="text-soft">No notifications yet.</p>}</div></section>}
      </>}
    </div></section>
  );
}
