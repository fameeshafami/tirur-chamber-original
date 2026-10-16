import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { publicApi, jobSeekerApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const JOB_TYPES = ['All Types', 'Full-time', 'Part-time', 'Contract', 'Internship'];

const isJobOpen = (job) => {
  if (job.status && job.status !== 'published') return false;
  if (!job.closingDate) return true;
  const deadline = new Date(job.closingDate);
  deadline.setHours(23, 59, 59, 999);
  return deadline >= new Date();
};

function JobDetailPanel({ job, onClose, onApply, onSave, savedIds, appliedIds }) {
  const { isLoggedIn, isJobSeeker } = useAuth();
  const isSaved    = savedIds.has(job._id);
  const isApplied  = appliedIds.has(job._id);
  const isOpen = isJobOpen(job);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={job.title}
    >
      <div style={{ background: '#fff', width: '100%', maxWidth: 520, height: '90vh', overflowY: 'auto', padding: 24, borderRadius: '18px 18px 0 0', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'var(--bg)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }} aria-label="Close">✕</button>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{job.title}</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 12 }}>{job.company || '—'}</p>
        <div className="job-chips" style={{ marginBottom: 16 }}>
          {job.location       && <span className="job-chip">📍 {job.location}</span>}
          {job.employmentType && <span className="job-chip">{job.employmentType}</span>}
          {job.salary         && <span className="job-chip">💰 {job.salary}</span>}
          {job.experience     && <span className="job-chip">🎯 {job.experience}</span>}
          {job.quantity > 1   && <span className="job-chip">{job.quantity} openings</span>}
        </div>
        {job.closingDate && (
          <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>
            ⏰ Apply before: {new Date(job.closingDate).toLocaleDateString('en-IN')}
          </p>
        )}
        {job.description && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13.5, color: 'var(--brand-dark)', marginBottom: 6 }}>Job Description</h4>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{job.description}</p>
          </div>
        )}
        {job.requirements && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13.5, color: 'var(--brand-dark)', marginBottom: 6 }}>Requirements</h4>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{job.requirements}</p>
          </div>
        )}
        {job.skills?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13.5, color: 'var(--brand-dark)', marginBottom: 6 }}>Skills Required</h4>
            <div className="job-chips">{job.skills.map((s) => <span key={s} className="job-chip">{s}</span>)}</div>
          </div>
        )}
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          {!isOpen ? <span className="badge badge-danger">Applications closed</span> : job.applicationMethod === 'external' && job.applicationLink ? (
            <a href={job.applicationLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Apply on Website →
            </a>
          ) : isLoggedIn && isJobSeeker ? (
            isApplied ? (
              <button className="btn btn-outline" disabled>✓ Applied</button>
            ) : (
              <button className="btn btn-primary" onClick={() => onApply(job)}>Apply Now</button>
            )
          ) : !isLoggedIn ? (
            <Link to="/login" className="btn btn-primary">Login to Apply</Link>
          ) : null}

          {isLoggedIn && isJobSeeker && (
            <button
              className={`btn ${isSaved ? 'btn-accent' : 'btn-outline'}`}
              onClick={() => onSave(job)}
            >
              {isSaved ? '★ Saved' : '☆ Save Job'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplyModal({ job, onClose, onSubmit, loading, userCv }) {
  const [form, setForm] = useState({ coverLetter: '', education: '', experience: '', skills: '' });
  const [cvFile, setCvFile] = useState(null);
  const [cvFileName, setCvFileName] = useState('');
  const [cvError, setCvError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFileChange = (e) => {
    setCvError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['pdf', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setCvError('Only PDF, DOC, or DOCX files are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCvError('File size must be 5 MB or less.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      setCvFile({
        file: base64,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
      setCvFileName(file.name);
    };
    reader.onerror = () => setCvError('Error reading file. Please try again.');
    reader.readAsDataURL(file);
  };

  const hasCv = Boolean(cvFile || userCv?.fileName);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} role="dialog" aria-modal="true" aria-label="Apply for job">
      <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Apply: {job.title}</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 18 }}>{job.company}</p>
        <div className="form-group">
          <label htmlFor="apply-edu">Education</label>
          <input id="apply-edu" className="form-control" value={form.education} onChange={(e) => set('education', e.target.value)} placeholder="Your highest qualification" />
        </div>
        <div className="form-group">
          <label htmlFor="apply-exp">Experience</label>
          <input id="apply-exp" className="form-control" value={form.experience} onChange={(e) => set('experience', e.target.value)} placeholder="Years of relevant experience" />
        </div>
        <div className="form-group">
          <label htmlFor="apply-skills">Skills (comma-separated)</label>
          <input id="apply-skills" className="form-control" value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="e.g. React, Node.js, MS Office" />
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Resume / CV {job.applicationMethod === 'tirur_connect' && <span style={{ color: 'var(--danger)' }}>*</span>}</span>
            {hasCv && (
              <span className="cv-selected-badge">
                ✓ {cvFileName || userCv?.fileName}
              </span>
            )}
          </div>
          <div className="cv-upload-dropzone">
            <input
              id="apply-cv"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            <div className="cv-dropzone-icon">📄</div>
            <div className="cv-dropzone-text">
              {cvFileName ? 'Click or drop to replace CV' : userCv?.fileName ? 'Click or drop to replace CV' : 'Click or drop your CV here'}
            </div>
            <div className="cv-dropzone-subtext">
              PDF, DOC, or DOCX up to 5 MB
            </div>
          </div>
          {cvError && <span className="form-error" role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, display: 'block' }}>{cvError}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="apply-letter">Cover Letter (optional)</label>
          <textarea id="apply-letter" className="form-control" rows={4} value={form.coverLetter} onChange={(e) => set('coverLetter', e.target.value)} placeholder="Why are you a good fit for this role?" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit({
              ...form,
              skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
              cvData: cvFile || undefined
            })}
            disabled={loading}
          >
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Jobs() {
  const { isLoggedIn, isJobSeeker } = useAuth();
  const toast = useToast();

  const [jobs,       setJobs]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [empType,    setEmpType]    = useState('All Types');
  const [selected,   setSelected]   = useState(null);
  const [applying,   setApplying]   = useState(null);
  const [applyLoad,  setApplyLoad]  = useState(false);
  const [savedIds,   setSavedIds]   = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [userCv,     setUserCv]     = useState(null);

  const LIMIT = 10;

  const fetchJobs = useCallback(async (pg = 1, s = search, type = empType) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: pg, limit: LIMIT, status: 'published' });
      if (s.trim()) p.set('search', s.trim());
      if (type !== 'All Types') p.set('employmentType', type);
      const res = await publicApi.jobs(p.toString());
      setJobs(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { setJobs([]); } finally { setLoading(false); }
  }, [search, empType]);

  // Load saved & applied jobs and user CV for job seekers
  useEffect(() => {
    if (!isLoggedIn || !isJobSeeker) return;
    jobSeekerApi.savedJobs().then((r) => setSavedIds(new Set((r.data || []).map((s) => s.job?._id || s.job)))).catch(() => {});
    jobSeekerApi.applications().then((r) => setAppliedIds(new Set((r.data || []).map((a) => a.job?._id || a.job)))).catch(() => {});
    jobSeekerApi.getCv().then((r) => setUserCv(r.cv || null)).catch(() => {});
  }, [isLoggedIn, isJobSeeker]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchJobs(1, search, empType);
  };

  const handleApplySubmit = async (formData) => {
    if (!applying) return;
    setApplyLoad(true);
    try {
      await jobSeekerApi.apply({ jobId: applying._id, ...formData });
      if (formData.cvData?.fileName) {
        setUserCv({ fileName: formData.cvData.fileName, uploadedAt: new Date() });
      }
      setAppliedIds((s) => new Set([...s, applying._id]));
      toast('Application submitted!', 'success');
      setApplying(null);
    } catch (err) {
      toast(err.message || 'Application failed.', 'error');
    } finally { setApplyLoad(false); }
  };

  const handleSave = async (job) => {
    if (!isLoggedIn || !isJobSeeker) { toast('Login as a job seeker to save jobs.'); return; }
    try {
      if (savedIds.has(job._id)) {
        await jobSeekerApi.unsaveJob(job._id);
        setSavedIds((s) => { const n = new Set(s); n.delete(job._id); return n; });
        toast('Job removed from saved.');
      } else {
        await jobSeekerApi.saveJob(job._id);
        setSavedIds((s) => new Set([...s, job._id]));
        toast('Job saved!', 'success');
      }
    } catch (err) { toast(err.message || 'Failed.', 'error'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-dark)', marginBottom: 6 }}>Jobs &amp; Careers</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          {total > 0 ? `${total} openings in Tirur` : 'Find local job opportunities in Tirur'}
        </p>
      </div>

      <form onSubmit={handleSearch} className="filter-bar" role="search">
        <input className="form-control" style={{ flex: 1 }} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs, companies…" aria-label="Search jobs" />
        <select className="form-control" style={{ width: 'auto' }} value={empType} onChange={(e) => { setEmpType(e.target.value); setPage(1); fetchJobs(1, search, e.target.value); }} aria-label="Employment type">
          {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {isLoggedIn && isJobSeeker && (
        <div className="jobs-cv-callout">
          <div><strong>Ready to apply?</strong><span>Upload your CV once and use it for Tirur Connect applications.</span></div>
          <Link to="/job-seeker" className="btn btn-outline btn-sm">Upload CV</Link>
        </div>
      )}

      {/* Job seeker callout */}
      {!isLoggedIn && (
        <div className="card" style={{ background: 'linear-gradient(100deg,var(--brand-light),#fffdf5)', border: '1px solid #cfe6dc', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--brand-dark)' }}>Looking for work?</strong>
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Create a free account to apply for jobs and track your applications.</span>
          </div>
          <Link to="/login?role=job_seeker" className="btn btn-primary btn-sm">Create Account</Link>
        </div>
      )}

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💼</div>
          <h3>No jobs found</h3>
          <p>Try a different search term or check back soon.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} role="list">
            {jobs.map((job) => (
              <button
                key={job._id}
                className="card card-hover"
                onClick={() => setSelected(job)}
                style={{ textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}
                role="listitem"
                aria-label={`${job.title} at ${job.company || 'company'}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 3 }}>{job.title}</h3>
                    <p className="job-company" style={{ marginBottom: 8 }}>{job.company || '—'}</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(job.publishedAt || job.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div className="job-chips">
                  {job.location       && <span className="job-chip">📍 {job.location}</span>}
                  {job.employmentType && <span className="job-chip type">{job.employmentType}</span>}
                  {job.salary         && <span className="job-chip">💰 {job.salary}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>View Details →</span>
                  {appliedIds.has(job._id) && <span className="badge badge-success">✓ Applied</span>}
                  {savedIds.has(job._id)   && <span className="badge">★ Saved</span>}
                </div>
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => { setPage(page - 1); fetchJobs(page - 1); }} disabled={page === 1} aria-label="Previous">‹</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => { setPage(p); fetchJobs(p); }}>{p}</button>
              ))}
              <button className="page-btn" onClick={() => { setPage(page + 1); fetchJobs(page + 1); }} disabled={page === totalPages} aria-label="Next">›</button>
            </div>
          )}
        </>
      )}

      {/* Post jobs CTA */}
      <div className="card" style={{ marginTop: 32, background: 'linear-gradient(135deg,var(--brand-light),#fffdf5)', border: '1px solid #cfe6dc', textAlign: 'center', padding: '24px 20px' }}>
        <h3 style={{ fontSize: 16, color: 'var(--brand-dark)', marginBottom: 6 }}>Hiring? Post a Job for Free</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 14 }}>Reach hundreds of job seekers in Tirur and nearby areas.</p>
        <Link to="/shop-owner" className="btn btn-primary">Post a Job</Link>
      </div>

      {/* Job detail panel */}
      {selected && (
        <JobDetailPanel
          job={selected}
          onClose={() => setSelected(null)}
          onApply={(j) => { if (!isJobOpen(j)) { toast('This job is no longer accepting applications.', 'error'); return; } setSelected(null); setApplying(j); }}
          onSave={handleSave}
          savedIds={savedIds}
          appliedIds={appliedIds}
        />
      )}

      {/* Apply modal */}
      {applying && (
        <ApplyModal
          job={applying}
          onClose={() => setApplying(null)}
          onSubmit={handleApplySubmit}
          loading={applyLoad}
          userCv={userCv}
        />
      )}
    </div>
  );
}
