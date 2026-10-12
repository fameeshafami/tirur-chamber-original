import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import Header from './Header';
import Footer from './Footer';
import TabBar from './TabBar';
import { publicApi } from '../lib/api';

const FALLBACK_NOTICES = [
  "⛅ Today's Weather: 31°C, Partly Cloudy — Humidity 78%",
  '🚧 Road work near Tirur Junction, expect delays till 6 PM',
  '🩸 Blood donation camp at Town Hall — Sunday 10 AM',
  '💡 Power maintenance in Ward 4 tomorrow 10 AM–1 PM',
];

const STAT_CATEGORIES = new Set(['shops_joined', 'hirings', 'active_members', 'ad_slots']);

function noticeKey(item) {
  return `tc-notice-${item._id || item.text}`;
}

function isPopupNotice(item) {
  return item?.source === 'manual' && item.text && !STAT_CATEGORIES.has(item.category);
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const [notices, setNotices] = useState([]);
  const [popup, setPopup] = useState(null);
  const isDashboard = /^\/(admin|super-admin|shop-owner|job-seeker|chamber-member)(\/|$)/.test(pathname);

  useEffect(() => {
    let mounted = true;
    publicApi.communityUpdates()
      .then((response) => {
        if (!mounted) return;
        const items = Array.isArray(response.data) ? response.data.filter((item) => item?.text) : [];
        setNotices(items);
        if (isDashboard) return;
        const next = items.find(isPopupNotice);
        if (!next || sessionStorage.getItem(noticeKey(next))) return;
        setPopup(next);
      })
      .catch(() => {
        if (mounted) setNotices([]);
      });
    return () => {
      mounted = false;
    };
  }, [isDashboard]);

  const liveNotices = notices.map((item) => `${item.icon || '📌'} ${item.text}`);
  const tickerItems = [...liveNotices, ...FALLBACK_NOTICES];
  const tickerText = tickerItems.join('   •   ');

  function closePopup() {
    if (popup) sessionStorage.setItem(noticeKey(popup), '1');
    setPopup(null);
  }

  return (
    <>
      <TopBar />
      <Header />
      <div className="ticker-wrap" role="region" aria-label="Local notices">
        <div className="container">
          <span className="ticker-tag">NOTICE</span>
          <div className="ticker-track">
            <span className="ticker-inner">
              <span>{tickerText}</span>
              <span aria-hidden="true">{tickerText}</span>
            </span>
          </div>
        </div>
      </div>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <TabBar />
      {popup && (
        <div className="ad-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePopup(); }}>
          <section className="ad-modal-box" role="dialog" aria-modal="true" aria-labelledby="notice-popup-title">
            <button className="ad-modal-close" type="button" onClick={closePopup} aria-label="Close notice">×</button>
            <div className="ad-modal-label"><span className="ad-modal-badge">NOTICE</span></div>
            <div className="ad-modal-body">
              <strong className="ad-modal-title" id="notice-popup-title">{popup.icon ? `${popup.icon} ` : ''}{popup.category?.replace(/_/g, ' ') || 'Update'}</strong>
              <p className="ad-modal-sub notice-popup-text">{popup.text}</p>
            </div>
            <div className="ad-modal-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={closePopup}>Got it</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
