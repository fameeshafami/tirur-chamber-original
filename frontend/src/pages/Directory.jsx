import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { publicApi } from '../lib/api';

const CATEGORIES = [
  'All', 'Food & Dining', 'Fashion', 'Healthcare', 'Education',
  'Electronics', 'Hardware', 'Salon & Beauty', 'Automobile',
  'Finance', 'Real Estate', 'Travel', 'Grocery',
];

function BusinessModal({ biz, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={biz.businessName || biz.name}
    >
      <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'var(--bg)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}
          aria-label="Close"
        >✕</button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <div className="biz-logo" style={{ width: 64, height: 64, fontSize: 22, flexShrink: 0 }}>
            {biz.logo
              ? <img src={biz.logo} alt={biz.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
              : (biz.name ? biz.name.charAt(0) : 'B')}
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{biz.businessName || biz.name}</h2>
            <span className="tag">{biz.category}</span>
            {' '}
            <span className={`tag ${biz.open ? 'tag-open' : 'tag-closed'}`}>{biz.open ? 'Open' : 'Closed'}</span>
          </div>
        </div>
        {biz.description && (
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 14 }}>{biz.description}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            biz.phone   && { label: 'Phone',   val: biz.phone,   icon: '📞' },
            biz.email   && { label: 'Email',   val: biz.email,   icon: '📧' },
            biz.address && { label: 'Address', val: biz.address, icon: '📍' },
            biz.hours   && { label: 'Hours',   val: biz.hours,   icon: '🕐' },
          ].filter(Boolean).map(({ label, val, icon }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 9, padding: '9px 11px' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{icon} {label}</span>
              <strong style={{ display: 'block', fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>{val}</strong>
            </div>
          ))}
        </div>
        {biz.website && (
          <a href={biz.website} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
            Visit Website →
          </a>
        )}
      </div>
    </div>
  );
}

export default function Directory() {
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();

  const [businesses, setBusinesses] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [category,   setCategory]   = useState(searchParams.get('category') || searchParams.get('cat') || 'All');
  const [businessStatus, setBusinessStatus] = useState(searchParams.get('open') || '');
  const [selected,   setSelected]   = useState(null);

  const LIMIT = 12;

  const fetchBusinesses = useCallback(async (pg = 1, s = search, cat = category, open = businessStatus) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT, status: 'approved' });
      if (s.trim())      params.set('search', s.trim());
      if (cat !== 'All') params.set('category', cat);
      if (open) params.set('open', open);
      const res = await publicApi.businesses(params.toString());
      setBusinesses(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, businessStatus]);

  // Open modal from ?id= query param
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      publicApi.business(id).then((r) => setSelected(r.business || r)).catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => { fetchBusinesses(1, search, category); }, [fetchBusinesses]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBusinesses(1, search, category);
  };

  const handleCategory = (cat) => {
    setCategory(cat);
    setPage(1);
    fetchBusinesses(1, search, cat);
  };

  const handleBusinessStatus = (open) => {
    setBusinessStatus(open);
    setPage(1);
    fetchBusinesses(1, search, category, open);
  };

  const handlePage = (p) => {
    setPage(p);
    fetchBusinesses(p, search, category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-dark)', marginBottom: 6 }}>
          Business Directory
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          {total > 0 ? `${total} businesses found in Tirur` : 'Explore local businesses in Tirur'}
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="filter-bar" role="search">
        <input
          className="form-control"
          style={{ flex: 1, minWidth: 180 }}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search businesses…"
          aria-label="Search businesses"
        />
        <select value={businessStatus} onChange={(event) => handleBusinessStatus(event.target.value)} aria-label="Filter businesses by opening status">
          <option value="">All statuses</option>
          <option value="true">Open now</option>
          <option value="false">Closed</option>
        </select>
        <button type="submit" className="btn btn-primary">Search</button>
        <Link to="/list-business" className="btn btn-outline hide-mobile">+ Add Listing</Link>
      </form>

      {/* Category chips */}
      <div className="chip-row" role="list" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`chip${category === cat ? ' active' : ''}`}
            onClick={() => handleCategory(cat)}
            role="listitem"
            aria-pressed={category === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="spinner-wrap"><div className="spinner" aria-label="Loading businesses" /></div>
      ) : businesses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏪</div>
          <h3>No businesses found</h3>
          <p>Try a different search term or category.</p>
          <Link to="/list-business" className="btn btn-primary" style={{ marginTop: 14 }}>
            List Your Business
          </Link>
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }} role="list">
            {businesses.map((biz) => (
              <button
                key={biz._id}
                className="card card-hover biz-card"
                onClick={() => setSelected(biz)}
                style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--card)', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}
                aria-label={`View details for ${biz.businessName || biz.name}`}
                role="listitem"
              >
                <div className="biz-logo" aria-hidden="true">
                  {biz.logo
                    ? <img src={biz.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                    : (biz.name ? biz.name.charAt(0).toUpperCase() : 'B')}
                </div>
                <div className="biz-body">
                  <div className="biz-top">
                    <h3 className="biz-name">{biz.businessName || biz.name}</h3>
                    <span className={`tag ${biz.open ? 'tag-open' : 'tag-closed'}`}>{biz.open ? 'Open' : 'Closed'}</span>
                  </div>
                  <span className="tag" style={{ marginBottom: 6 }}>{biz.category}</span>
                  <div className="meta-row">
                    {biz.phone    && <span>📞 {biz.phone}</span>}
                    {biz.location && <span>📍 {biz.location}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" role="navigation" aria-label="Pagination">
              <button className="page-btn" onClick={() => handlePage(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) < 3 || p === 1 || p === totalPages)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--ink-soft)' }}>…</span>
                    : <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => handlePage(p)} aria-label={`Page ${p}`} aria-current={page === p ? 'page' : undefined}>{p}</button>
                )}
              <button className="page-btn" onClick={() => handlePage(page + 1)} disabled={page === totalPages} aria-label="Next page">›</button>
            </div>
          )}
        </>
      )}

      {/* Business detail modal */}
      {selected && <BusinessModal biz={selected} onClose={() => { setSelected(null); navigate('/directory', { replace: true }); }} />}

      {/* List biz CTA */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 12 }}>Own a business in Tirur? Get discovered online for free.</p>
        <Link to="/list-business" className="btn btn-primary btn-lg">+ Add Your Business</Link>
      </div>
    </div>
  );
}
