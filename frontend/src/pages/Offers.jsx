import { useEffect, useState } from 'react';
import { publicApi } from '../lib/api';

const CATEGORIES = ['education', 'electronics', 'food', 'coffee', 'offers', 'local'];
const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '');

export default function Offers() {
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    publicApi
      .offers(category ? `category=${encodeURIComponent(category)}` : '')
      .then((r) => alive && setItems(r.data || []))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [category]);

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h1>Offers</h1>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
          <div className="grid">
            {items.length ? items.map((o) => (
              <a key={o._id} className="card" href={o.link || '#'} target={o.link ? '_blank' : undefined} rel="noopener noreferrer">
                {o.image && <img src={o.image} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} />}
                <span className="tag">{o.category || 'Offer'}</span>
                <h3>{o.title}</h3>
                <p className="text-soft">{o.description}</p>
                <small>{fmt(o.startDate)} – {fmt(o.endDate)}</small>
              </a>
            )) : <div className="empty-state">No offers available.</div>}
          </div>
        )}
      </div>
    </section>
  );
}
