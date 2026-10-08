import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../lib/api';

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '');
const Spinner = () => <div className="spinner-wrap"><div className="spinner" /></div>;

export default function News() {
  const { slug } = useParams();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const query = search.trim() ? new URLSearchParams({ search: search.trim() }).toString() : '';
    const req = slug
      ? publicApi.newsItem(slug).then((r) => alive && setItem(r.news || null))
      : publicApi.news(query).then((r) => alive && setItems(r.data || []));
    req
      .catch(() => { if (alive) { setItems([]); setItem(null); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug, search]);

  return (
    <section className="section">
      <div className="container">
        {slug ? (
          <>
            <p><Link to="/news">← All news</Link></p>
            {loading ? <Spinner /> : item ? (
              <article className="card">
                <span className="tag">{item.category || 'News'}</span>
                <h1>{item.title}</h1>
                <p className="text-soft">{fmt(item.publishedAt)}</p>
                {item.image && <img src={item.image} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }} />}
                <p>{item.description || item.summary}</p>
                <div style={{ whiteSpace: 'pre-line' }}>{item.content}</div>
              </article>
            ) : <div className="empty-state">News not found.</div>}
          </>
        ) : (
          <>
            <div className="section-head">
              <h1>News</h1>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search news" aria-label="Search news" />
            </div>
            {loading ? <Spinner /> : (
              <div className="grid">
                {items.length ? items.map((n) => (
                  <Link key={n._id || n.slug} className="card" to={`/news/${encodeURIComponent(n.slug)}`}>
                    {n.image && <img src={n.image} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} />}
                    <span className="tag">{n.category || 'News'}</span>
                    <h3>{n.title}</h3>
                    <p className="text-soft">{n.description || n.summary}</p>
                    <small>{fmt(n.publishedAt)}</small>
                  </Link>
                )) : <div className="empty-state">No news available.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
