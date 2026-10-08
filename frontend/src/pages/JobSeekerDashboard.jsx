import { useEffect, useState } from 'react';
import { jobSeekerApi, publicApi, auth } from '../lib/api';
import { useToast } from '../components/Toast.jsx';
import PasswordVisibilityToggle from '../components/PasswordVisibilityToggle.jsx';

const TABS = [
  ['overview', '📊 Overview'], ['profile', '👤 Profile'], ['cv', '📄 My CV'],
  ['jobs', '💼 Find jobs'], ['saved', '☆ Saved jobs'], ['applications', '📝 Applications'],
  ['notifications', '🔔 Notifications'], ['settings', '⚙️ Settings'],
];

const emptyProfile = { name: '', email: '', phone: '', location: '', bio: '', education: '', experience: '', skills: '' };

export default function JobSeekerDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [cv, setCv] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [applicationJob, setApplicationJob] = useState(null);
  const [applicationForm, setApplicationForm] = useState({ coverLetter: '', education: '', experience: '', skills: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      const [profileResult, cvResult, jobsResult, savedResult, applicationsResult, notificationsResult] = await Promise.all([
        jobSeekerApi.profile(),
        jobSeekerApi.getCv(),
        publicApi.jobs('status=published&limit=100'),
        jobSeekerApi.savedJobs(),
        jobSeekerApi.applications(),
        jobSeekerApi.notifications(),
      ]);
      const user = profileResult.user || {};
      setProfile({
        name: user.name || '', email: user.email || '', phone: user.phone || '',
        location: user.location || '', bio: user.bio || '', education: user.education || '',
        experience: user.experience || '', skills: Array.isArray(user.skills) ? user.skills.join(', ') : user.skills || '',
      });
      setCv(cvResult.cv || null);
      setJobs(jobsResult.data || []);
      setSavedJobs(savedResult.data || []);
      setApplications(applicationsResult.data || []);
      setNotifications(notificationsResult.data || []);
    } catch (error) {
      setLoadError(error.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData().catch(() => {}); }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await jobSeekerApi.updateProfile({
        ...profile,
        skills: profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      });
      const user = result.user || {};
      setProfile((current) => ({ ...current, ...user, skills: Array.isArray(user.skills) ? user.skills.join(', ') : current.skills }));
      toast('Profile saved.', 'success');
    } catch (error) {
      toast(error.message || 'Unable to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadCv(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      toast('Choose a PDF, DOC, or DOCX file.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('CV must be 5 MB or smaller.', 'error');
      input.value = '';
      return;
    }
    try {
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await jobSeekerApi.uploadCv({ file: encoded, fileName: file.name, fileType: file.type || 'application/octet-stream', fileSize: file.size });
      setCv(result.cv || null);
      toast('CV uploaded.', 'success');
    } catch (error) {
      toast(error.message || 'Unable to upload CV.', 'error');
    } finally {
      input.value = '';
    }
  }

  async function deleteCv() {
    if (!window.confirm('Delete your uploaded CV?')) return;
    try {
      await jobSeekerApi.deleteCv();
      setCv(null);
      toast('CV deleted.', 'success');
    } catch (error) {
      toast(error.message || 'Unable to delete CV.', 'error');
    }
  }

  async function toggleSaved(job) {
    const saved = savedJobs.some((item) => String(item.job?._id || item.job) === String(job._id));
    try {
      if (saved) {
        await jobSeekerApi.unsaveJob(job._id);
        setSavedJobs((items) => items.filter((item) => String(item.job?._id || item.job) !== String(job._id)));
        toast('Job removed from saved jobs.');
      } else {
        const result = await jobSeekerApi.saveJob(job._id);
        setSavedJobs((items) => [...items, { ...result.savedJob, job }]);
        toast('Job saved.', 'success');
      }
    } catch (error) {
      toast(error.message || 'Unable to update saved jobs.', 'error');
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!applicationJob) return;
    if (applicationJob.applicationMethod !== 'external' && !cv?.fileName) {
      setTab('cv');
      setApplicationJob(null);
      toast('Upload a CV before applying to this job.', 'error');
      return;
    }
    setSaving(true);
    try {
      await jobSeekerApi.apply({
        jobId: applicationJob._id,
        ...applicationForm,
        skills: applicationForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      });
      setApplicationJob(null);
      setApplicationForm({ coverLetter: '', education: '', experience: '', skills: '' });
      toast('Application submitted.', 'success');
      await loadData();
    } catch (error) {
      toast(error.message || 'Unable to submit application.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function markNotificationRead(id) {
    try {
      await jobSeekerApi.markRead(id);
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (error) {
      toast(error.message || 'Unable to update notification.', 'error');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.elements.currentPassword.value;
    const newPassword = form.elements.newPassword.value;
    setSaving(true);
    try {
      await auth.changePassword({ currentPassword, newPassword });
      form.reset();
      toast('Password updated.', 'success');
    } catch (error) {
      toast(error.message || 'Unable to update password.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(query);
    const matchesLocation = !location || job.location === location;
    const matchesType = !employmentType || job.employmentType === employmentType;
    return matchesSearch && matchesLocation && matchesType;
  });
  const locations = [...new Set(jobs.map((job) => job.location).filter(Boolean))].sort();
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const appliedIds = new Set(applications.map((application) => String(application.job?._id || application.job)));
  const profileFields = ['name', 'phone', 'location', 'bio', 'education', 'experience', 'skills'];
  const completedFields = profileFields.filter((field) => Boolean(profile[field]?.trim())).length + Number(Boolean(cv?.fileName));
  const completion = Math.round((completedFields / (profileFields.length + 1)) * 100);

  return (
    <section className="section">
      <div className="container chamber-dashboard">
        <header className="chamber-dashboard-heading">
          <div><h1>Job Seeker Dashboard</h1><p className="text-soft">Manage your profile, CV, saved jobs, and applications.</p></div>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadData} disabled={loading}>↻ Refresh</button>
        </header>
        <nav className="chamber-dashboard-tabs" aria-label="Job seeker dashboard sections">
          {TABS.map(([key, label]) => <button key={key} type="button" className={`dash-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}{key === 'notifications' && unreadCount ? ` (${unreadCount})` : ''}</button>)}
        </nav>
        {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
        {loading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading job seeker dashboard" /></div> : (
          <>
            {tab === 'overview' && <div>
              <div className="chamber-overview-grid">
                {[
                  ['Profile completion', `${completion}%`], ['Applications', applications.length],
                  ['Saved jobs', savedJobs.length], ['Unread alerts', unreadCount],
                ].map(([label, value]) => <div className="chamber-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
                <section className="chamber-panel chamber-overview-summary">
                  <h2>Profile completion</h2>
                  <div className="jobseeker-progress"><span style={{ width: `${completion}%` }} /></div>
                  <p className="text-soft">{completedFields} of {profileFields.length + 1} profile details complete, including CV upload.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab(completion === 100 ? 'jobs' : 'profile')}>{completion === 100 ? 'Browse jobs' : 'Complete profile'}</button>
                </section>
              </div>
            </div>}

            {tab === 'profile' && <form className="chamber-panel chamber-form" onSubmit={saveProfile}>
              <h2>My profile</h2>
              <div className="admin-field-row"><label>Name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required /></label></div>
              <div className="admin-field-row"><label>Phone<input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label><label>Location<input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} /></label></div>
              <label>Bio<textarea rows="4" value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
              <div className="admin-field-row"><label>Education<input value={profile.education} onChange={(event) => setProfile({ ...profile, education: event.target.value })} /></label><label>Experience<input value={profile.experience} onChange={(event) => setProfile({ ...profile, experience: event.target.value })} /></label></div>
              <label>Skills (comma-separated)<input value={profile.skills} onChange={(event) => setProfile({ ...profile, skills: event.target.value })} /></label>
              <button className="btn btn-primary" disabled={saving}>Save profile</button>
            </form>}

            {tab === 'cv' && <section className="chamber-panel"><h2>My CV</h2>
              {cv?.fileName ? <div className="jobseeker-cv-current"><div><strong>{cv.fileName}</strong><p className="text-soft">Uploaded {cv.uploadedAt ? new Date(cv.uploadedAt).toLocaleDateString('en-IN') : ''} · Visible to active admins and paid Chamber members</p></div><button type="button" className="btn btn-danger btn-sm" onClick={deleteCv}>Delete CV</button></div> : <p className="text-soft">No CV uploaded yet. PDF, DOC, or DOCX files up to 5 MB are accepted.</p>}
              <label className="jobseeker-upload">{cv?.fileName ? 'Replace CV' : 'Upload CV'}<input type="file" accept=".pdf,.doc,.docx" onChange={uploadCv} /></label>
            </section>}

            {tab === 'jobs' && <section className="chamber-panel"><h2>Find jobs</h2>
              <div className="filter-bar jobseeker-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or company" aria-label="Search jobs" /><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter location"><option value="">All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} aria-label="Filter job type"><option value="">All types</option>{['Full-time', 'Part-time', 'Contract', 'Internship'].map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="jobseeker-job-list">{filteredJobs.map((job) => {
                const isSaved = savedJobs.some((item) => String(item.job?._id || item.job) === String(job._id));
                const alreadyApplied = appliedIds.has(String(job._id));
                return <article className="jobseeker-job" key={job._id}><div><h3>{job.title}</h3><p>{job.business?.name || job.company || 'Local business'} · {job.location || 'Tirur'}</p><div className="job-chips">{job.employmentType && <span className="job-chip type">{job.employmentType}</span>}{job.salary && <span className="job-chip">{job.salary}</span>}{job.experience && <span className="job-chip">{job.experience}</span>}</div></div><div className="admin-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => toggleSaved(job)}>{isSaved ? '★ Saved' : '☆ Save'}</button>{alreadyApplied ? <button type="button" className="btn btn-outline btn-sm" disabled>Applied</button> : job.applicationMethod === 'external' && job.applicationLink ? <a className="btn btn-primary btn-sm" href={job.applicationLink} target="_blank" rel="noopener noreferrer">Apply</a> : <button type="button" className="btn btn-primary btn-sm" onClick={() => setApplicationJob(job)}>Apply</button>}</div></article>;
              })}{!filteredJobs.length && <p className="text-soft">No jobs match your filters.</p>}</div>
            </section>}

            {tab === 'saved' && <section className="chamber-panel"><h2>Saved jobs</h2><div className="jobseeker-job-list">{savedJobs.map((item) => {
              const job = item.job || {};
              return <article className="jobseeker-job" key={item._id || job._id}><div><h3>{job.title || 'Job'}</h3><p>{job.company || job.business?.name || 'Local business'} · {job.location || 'Tirur'}</p></div><div className="admin-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('jobs')}>Find related jobs</button><button type="button" className="btn btn-danger btn-sm" onClick={() => toggleSaved(job)}>Remove</button></div></article>;
            })}{!savedJobs.length && <p className="text-soft">No saved jobs yet.</p>}</div></section>}

            {tab === 'applications' && <section className="chamber-panel"><h2>My applications</h2><div className="jobseeker-job-list">{applications.map((application) => <article className="jobseeker-job" key={application._id}><div><h3>{application.job?.title || 'Application'}</h3><p>{application.job?.company || 'Local business'} · Applied {application.createdAt ? new Date(application.createdAt).toLocaleDateString('en-IN') : 'recently'}</p><span className={`status ${['eligible', 'shortlisted'].includes(application.status) ? 'active' : ['rejected', 'not_eligible'].includes(application.status) ? 'declined' : 'pending'}`}>{application.status || 'submitted'}</span></div></article>)}{!applications.length && <p className="text-soft">No applications yet.</p>}</div></section>}

            {tab === 'notifications' && <section className="chamber-panel"><h2>Notifications</h2><div className="chamber-notifications">{notifications.map((notification) => <article className={`chamber-notification${notification.readAt ? ' is-read' : ''}`} key={notification._id}><div><strong>{notification.message || notification.type}</strong><small>{notification.createdAt ? new Date(notification.createdAt).toLocaleDateString('en-IN') : ''}</small></div>{!notification.readAt && <button type="button" className="btn btn-outline btn-sm" onClick={() => markNotificationRead(notification._id)}>Mark read</button>}</article>)}{!notifications.length && <p className="text-soft">No notifications yet.</p>}</div></section>}

            {tab === 'settings' && <form className="chamber-panel chamber-form" onSubmit={saveSettings}><h2>Settings</h2><p className="text-soft">Change your password.</p><label>Current password<div className="password-control"><input name="currentPassword" type={showCurrentPassword ? 'text' : 'password'} autoComplete="current-password" required /><PasswordVisibilityToggle visible={showCurrentPassword} onToggle={() => setShowCurrentPassword((visible) => !visible)} /></div></label><label>New password<div className="password-control"><input name="newPassword" type={showNewPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" required /><PasswordVisibilityToggle visible={showNewPassword} onToggle={() => setShowNewPassword((visible) => !visible)} /></div></label><button className="btn btn-primary" disabled={saving}>Update password</button></form>}
          </>
        )}
      </div>

      {applicationJob && <div className="modal-bg open" role="dialog" aria-modal="true" aria-labelledby="job-application-title" onClick={(event) => { if (event.target === event.currentTarget && !saving) setApplicationJob(null); }}><form className="modal-box jobseeker-apply-modal" onSubmit={submitApplication}><h2 id="job-application-title">Apply: {applicationJob.title}</h2><p className="text-soft">{applicationJob.company || 'Local business'}</p>{applicationJob.applicationMethod !== 'external' && <div className="alert alert-info">A CV is required for applications submitted through Tirur Connect. {cv?.fileName ? `Current CV: ${cv.fileName}` : 'Upload your CV in the CV tab first.'}</div>}<label>Cover letter<textarea rows="4" value={applicationForm.coverLetter} onChange={(event) => setApplicationForm({ ...applicationForm, coverLetter: event.target.value })} /></label><div className="admin-field-row"><label>Education<input value={applicationForm.education} onChange={(event) => setApplicationForm({ ...applicationForm, education: event.target.value })} /></label><label>Experience<input value={applicationForm.experience} onChange={(event) => setApplicationForm({ ...applicationForm, experience: event.target.value })} /></label></div><label>Skills (comma-separated)<input value={applicationForm.skills} onChange={(event) => setApplicationForm({ ...applicationForm, skills: event.target.value })} /></label><div className="admin-actions"><button type="button" className="btn btn-outline" onClick={() => setApplicationJob(null)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || (applicationJob.applicationMethod !== 'external' && !cv?.fileName)}>{saving ? 'Submitting…' : 'Submit application'}</button></div></form></div>}
    </section>
  );
}
