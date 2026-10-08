import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const CATEGORIES = [
  'Food & Dining', 'Fashion', 'Healthcare', 'Education', 'Electronics',
  'Hardware', 'Salon & Beauty', 'Automobile', 'Finance', 'Real Estate',
  'Travel', 'Grocery', 'Restaurant', 'Pharmacy', 'Other',
];

const INIT = { name: '', ownerPhone: '', category: '', phone: '', email: '', address: '', location: 'Tirur', area: '', landmark: '', postal: '', description: '', website: '', hours: '', open: true };

export default function ListBusiness() {
  const toast        = useToast();
  const { isLoggedIn, user } = useAuth();
  const [form, setForm]   = useState({ ...INIT, ownerName: user?.name || '', ownerPhone: user?.phone || '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'Business name is required.';
    if (!form.ownerPhone.trim()) e.ownerPhone = 'Owner phone number is required.';
    if (!form.category)        e.category = 'Category is required.';
    if (!form.phone.trim())    e.phone    = 'Phone number is required.';
    if (!form.address.trim())  e.address  = 'Address is required.';
    if (!form.description.trim()) e.description = 'Service or business details are required.';
    if (!form.postal.trim()) e.postal = 'Postal code is required.';
    if (!/^[0-9+\s-]{10,15}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number.';
    if (form.ownerPhone.trim() && !/^[0-9+\s-]{10,15}$/.test(form.ownerPhone.trim())) e.ownerPhone = 'Enter a valid owner phone number.';
    if (!/^\d{6}$/.test(form.postal.trim())) e.postal = 'Enter a valid 6-digit PIN code.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const address = [form.address.trim(), form.landmark.trim() && `Landmark: ${form.landmark.trim()}`, `PIN: ${form.postal.trim()}`].filter(Boolean).join(', ');
      const location = form.area.trim() ? `Tirur · ${form.area.trim()}` : 'Tirur';
      const { area, landmark, postal, ...business } = form;
      await apiRequest('/businesses', { method: 'POST', body: JSON.stringify({ ...business, address, location }) });
      setSuccess(true);
      toast('Business listing submitted for admin approval.', 'success');
    } catch (err) {
      toast(err.message || 'Submission failed.', 'error');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="container" style={{ padding: '48px 16px', maxWidth: 560, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-dark)', marginBottom: 10 }}>Your listing is submitted for review</h2>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginBottom: 20 }}>
        The admin team will review your business details before it appears in the directory.
        You can manage your profile from the Shop Owner dashboard.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/directory" className="btn btn-primary">View Directory</Link>
        <Link to="/shop-owner" className="btn btn-outline">My Dashboard</Link>
      </div>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="container" style={{ padding: '48px 16px', maxWidth: 480, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🏪</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-dark)', marginBottom: 10 }}>List Your Business for Free</h2>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>
        Create a free account to add your business to the Tirur Connect directory and reach local customers.
      </p>
      <Link to="/login?role=shop_owner" className="btn btn-primary btn-lg">Create Free Account</Link>
    </div>
  );

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-dark)', marginBottom: 6 }}>
          List Your Business <span className="nav-badge" style={{ fontSize: 12, verticalAlign: 'middle' }}>FREE</span>
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Get discovered by thousands of people in Tirur. Free to list, no hidden charges.
        </p>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} noValidate>
          {/* Business info */}
          <h3 style={{ fontSize: 15, color: 'var(--brand-dark)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            Business Information
          </h3>

          <div className="form-group">
            <label htmlFor="biz-name">Business Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input id="biz-name" className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kerala Bakery" required aria-required="true" />
            {errors.name && <span className="form-error" role="alert">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="biz-owner">Owner Name</label>
            <input id="biz-owner" className="form-control" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Your name" />
          </div>

          <div className="form-group">
            <label htmlFor="biz-owner-phone">Owner Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input id="biz-owner-phone" className="form-control" type="tel" inputMode="tel" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="Enter owner phone number" required aria-required="true" />
            {errors.ownerPhone && <span className="form-error" role="alert">{errors.ownerPhone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="biz-cat">Category <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select id="biz-cat" className="form-control" value={form.category} onChange={(e) => set('category', e.target.value)} required aria-required="true">
              <option value="">Select a category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <span className="form-error" role="alert">{errors.category}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="biz-phone">Phone <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input id="biz-phone" className="form-control" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. 9400000000" required />
              {errors.phone && <span className="form-error" role="alert">{errors.phone}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="biz-email">Email</label>
              <input id="biz-email" className="form-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="business@email.com" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="biz-details">Service / business details <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea id="biz-details" className="form-control" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe your shop or service" required />
            {errors.description && <span className="form-error" role="alert">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="biz-address">Address <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input id="biz-address" className="form-control" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Full address in Tirur" required />
            {errors.address && <span className="form-error" role="alert">{errors.address}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="biz-location">City</label>
              <input id="biz-location" className="form-control" value={form.location} readOnly aria-label="City, fixed to Tirur" />
            </div>
            <div className="form-group">
              <label htmlFor="biz-area">Area / Locality</label>
              <input id="biz-area" className="form-control" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Main Road" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="biz-landmark">Landmark</label>
            <input id="biz-landmark" className="form-control" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Nearby landmark" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="biz-postal">Postal code</label>
              <input id="biz-postal" className="form-control" inputMode="numeric" maxLength={6} value={form.postal} onChange={(e) => set('postal', e.target.value)} placeholder="676101" />
              {errors.postal && <span className="form-error" role="alert">{errors.postal}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="biz-hours">Working hours</label>
              <input id="biz-hours" className="form-control" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="e.g. 9 AM – 8 PM" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="biz-web">Website (optional)</label>
            <input id="biz-web" className="form-control" type="url" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://yourbusiness.com" />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.open} onChange={(e) => set('open', e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Business is currently open</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Business Listing'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center', marginTop: 14 }}>
        Your free listing will appear in the directory after admin approval.
      </p>
    </div>
  );
}
