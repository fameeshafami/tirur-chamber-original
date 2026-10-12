import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl, publicApi } from '../lib/api';

const CATEGORIES = [
  { icon: '🍽️', label: 'Food & Dining', q: 'Food & Dining' },
  { icon: '👗', label: 'Fashion', q: 'Fashion' },
  { icon: '💊', label: 'Healthcare', q: 'Healthcare' },
  { icon: '🎓', label: 'Education', q: 'Education' },
  { icon: '⚡', label: 'Electronics', q: 'Electronics' },
  { icon: '🏗️', label: 'Hardware', q: 'Hardware' },
  { icon: '💈', label: 'Salon & Beauty', q: 'Salon & Beauty' },
  { icon: '🚗', label: 'Automobiles', q: 'Automobile' },
  { icon: '🧵', label: 'Textiles', q: 'Textiles' },
  { icon: '💍', label: 'Gold & Silver', q: 'Gold & Silver' },
];

const MEMBERSHIP_STEPS = [
  { number: '01', title: 'List your business', detail: 'Add your business profile and services.' },
  { number: '02', title: 'Verify your account', detail: 'Confirm your identity and contact details.' },
  { number: '03', title: 'Unlock your portal', detail: 'Access member tools, offers, and visibility.' },
];

function relativeTime(value, now) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const elapsedSeconds = (timestamp - now) / 1000;
  if (Math.abs(elapsedSeconds) < 60) return 'Just now';

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const unit = units.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds);
  return formatter.format(Math.round(elapsedSeconds / unit[1]), unit[0]);
}

function HeroSlider({ slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);
  const resumeTimer = useRef(null);
  const slideCount = slides.length;

  useEffect(() => {
    if (slideCount < 2 || paused) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % slideCount), 5000);
    return () => window.clearInterval(timer);
  }, [paused, slideCount]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  if (!slideCount) {
 
    return (
      <section className="home-hero-slider home-hero-fallback" aria-label="Tirur Connect">
        <div className="home-hero-caption">
          <h1>Welcome to Tirur Connect</h1>
          <p>Your local hub for businesses, jobs, news, and community updates in Tirur, Kerala.</p>
        </div>
      </section>
    );
  }
  const moveTo = (index) => setActiveIndex((index + slideCount) % slideCount);
  const pauseForTouch = () => {
    setPaused(true);
    window.clearTimeout(resumeTimer.current);
  };
  const resumeAfterTouch = () => {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 5000);
  };

  return (
    <section
      className="home-hero-slider"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onTouchStart={(event) => {
        pauseForTouch();
        touchStart.current = event.changedTouches[0].clientX;
      }}
      onTouchEnd={(event) => {
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 45) moveTo(activeIndex + (delta < 0 ? 1 : -1));
        resumeAfterTouch();
      }}
    >
      <div className="home-hero-slider-track">
        {slides.map((slide, index) => (
          <article className={`home-hero-slide${index === activeIndex ? ' is-active' : ''}${slide.show_text === true && (slide.title?.trim() || slide.description?.trim()) ? ' has-text' : ''}`} key={slide._id} aria-hidden={index !== activeIndex} inert={index !== activeIndex}>
            <picture>
              {slide.mobileImage && <source media="(max-width: 767px)" srcSet={mediaUrl(slide.mobileImage)} />}
              {slide.wideImage && <source media="(min-width: 1921px)" srcSet={mediaUrl(slide.wideImage)} />}
              <img
                src={mediaUrl(slide.desktopImage)}
                alt={slide.altText || slide.title || 'Tirur Connect featured banner'}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                referrerPolicy={slide.image_source === 'url' || slide.image_url || slide.mobile_image_source === 'url' || slide.mobile_image_url || slide.wide_image_source === 'url' || slide.wide_image_url || /^https:\/\//i.test(slide.desktopImage || '') ? 'no-referrer' : undefined}
                onError={(event) => {
                  const image = event.currentTarget;
                  const remote = mediaUrl(slide.image_url);
                  if (remote && image.dataset.fallback !== '1' && image.src !== remote) {
                    image.dataset.fallback = '1';
                    image.src = remote;
                    return;
                  }
                  image.hidden = true;
                  image.closest('.home-hero-slide')?.classList.add('is-image-fallback');
                }}
              />
            </picture>
            {slide.show_text === true && (slide.title?.trim() || slide.description?.trim()) && (
              <div className="home-hero-caption">
                {slide.title?.trim() && <h1>{slide.title}</h1>}
                {slide.description?.trim() && <p>{slide.description}</p>}
                {slide.buttonText && slide.buttonLink && <a className="home-hero-button" href={slide.buttonLink}>{slide.buttonText}</a>}
              </div>
            )}
          </article>
        ))}
      </div>
      {slideCount > 0 && (
        <>
          {slideCount > 1 && <>
          <button className="home-hero-arrow home-hero-prev" type="button" onClick={() => moveTo(activeIndex - 1)} aria-label="Previous slide">‹</button>
          <button className="home-hero-arrow home-hero-next" type="button" onClick={() => moveTo(activeIndex + 1)} aria-label="Next slide">›</button>
          </>}
          <div className="home-hero-dots" aria-label="Choose a featured slide">
            {slides.map((slide, index) => (
              <button key={slide._id} type="button" className={index === activeIndex ? 'is-active' : ''} onClick={() => moveTo(index)} aria-label={`Show slide ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Kept for reuse outside the hero slider (search is not rendered in HeroSlider).
export function HeroSearch({ onSearch, onCategoryChange }) {
  return (
    <form className="home-hero-search" role="search" onSubmit={(event) => {
      event.preventDefault();
      const query = event.currentTarget.q.value.trim();
      if (query) onSearch(query);
    }}>
      <input name="q" type="search" placeholder="Search businesses, services…" aria-label="Search businesses and services" />
      <select aria-label="Category" defaultValue="" onChange={(event) => {
        if (event.target.value) onCategoryChange(event.target.value);
      }}>
        <option value="">All Categories</option>
        {CATEGORIES.map((category) => <option key={category.q} value={category.q}>{category.label}</option>)}
      </select>
      <button className="btn btn-primary btn-sm" type="submit">Search</button>
    </form>
  );
}

function SideAdCard({ ad }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!ad.imageUrl || imageFailed) return null;
  return (
    <a
      className="side-ad-card"
      href={ad.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={ad.adTitle || ad.title || 'Sponsored advertisement'}
    >
      <img
        className="side-ad-image"
        src={mediaUrl(ad.imageUrl)}
        alt={ad.title || ad.adTitle || 'Sponsored advertisement'}
        loading="lazy"
        referrerPolicy={ad.image_source === 'url' || ad.image_url || /^https:\/\//i.test(ad.imageUrl || '') ? 'no-referrer' : undefined}
        onError={(event) => {
          const remote = mediaUrl(ad.image_url);
          if (remote && event.currentTarget.dataset.fallback !== '1' && event.currentTarget.src !== remote) {
            event.currentTarget.dataset.fallback = '1';
            event.currentTarget.src = remote;
            return;
          }
          setImageFailed(true);
        }}
      />
      {(ad.adTitle || ad.description) && (
        <span className="side-ad-copy">
          {ad.adTitle && <strong className="side-ad-title">{ad.adTitle}</strong>}
          {ad.description && <span className="side-ad-description">{ad.description}</span>}
        </span>
      )}
    </a>
  );
}

function SideAdSlot({ ads, side }) {
  const stackRef = useRef(null);
  const visibleAds = ads.filter((ad) => ad.imageUrl && ad.link).slice(0, 3);

  useEffect(() => {
    const stack = stackRef.current;
    const column = stack?.closest('.side-ad-column');
    if (!stack || !column) return undefined;
    const updateStickyState = () => {
      column.classList.toggle('side-ad-column--tall', stack.scrollHeight > Math.max(0, window.innerHeight - 90));
    };
    const observer = new ResizeObserver(updateStickyState);
    observer.observe(stack);
    window.addEventListener('resize', updateStickyState);
    updateStickyState();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateStickyState);
      column.classList.remove('side-ad-column--tall');
    };
  }, [visibleAds.length]);

  if (!visibleAds.length) return null;

  return (
    <div ref={stackRef} className={`home-side-ad home-side-ad-${side} side-ad-stack`}>
      <span className="home-sponsored-label side-ad-sponsored">Sponsored</span>
      <div className="side-ad-cards">
        {visibleAds.map((ad) => <SideAdCard key={ad._id} ad={ad} />)}
      </div>
    </div>
  );
}

function InlineAdCard({ ad }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(ad.imageUrl && !imageFailed);
  return (
    <a
      href={hasImage && ad.link ? ad.link : '/membership'}
      target={hasImage && ad.link ? '_blank' : undefined}
      rel={hasImage && ad.link ? 'noopener noreferrer' : undefined}
      aria-label={ad.title ? `Sponsored: ${ad.title}` : `Advertise in the ${ad.side} side ad slot`}
      className={!hasImage ? 'home-inline-ad-placeholder' : ''}
    >
      {hasImage ? (
        <>
          <span className="home-sponsored-label">Sponsored</span>
          <img src={mediaUrl(ad.imageUrl)} alt={ad.title || 'Sponsored advertisement'} loading="lazy" referrerPolicy={ad.image_source === 'url' || ad.image_url || /^https:\/\//i.test(ad.imageUrl || '') ? 'no-referrer' : undefined} onError={(event) => {
            const remote = mediaUrl(ad.image_url);
            if (remote && event.currentTarget.dataset.fallback !== '1' && event.currentTarget.src !== remote) {
              event.currentTarget.dataset.fallback = '1';
              event.currentTarget.src = remote;
              return;
            }
            setImageFailed(true);
          }} />
        </>
      ) : (
        <>
          <span className="home-sponsored-label">Sponsored</span>
          <span>Advertise here · {ad.side}</span>
        </>
      )}
    </a>
  );
}

function InlineAdStrip({ leftAds, rightAds }) {
  const visibleAds = [
    ...leftAds.filter((ad) => ad.imageUrl && ad.link).slice(0, 3).map((ad) => ({ ...ad, side: 'left' })),
    ...rightAds.filter((ad) => ad.imageUrl && ad.link).slice(0, 3).map((ad) => ({ ...ad, side: 'right' })),
  ];
  const entries = [
    ...visibleAds,
    ...(!leftAds.some((ad) => ad.imageUrl && ad.link) ? [{ _id: 'left-ad-placeholder', side: 'left' }] : []),
    ...(!rightAds.some((ad) => ad.imageUrl && ad.link) ? [{ _id: 'right-ad-placeholder', side: 'right' }] : []),
  ];
  return (
    <div className="home-inline-ad-strip" aria-label="Sponsored advertisements">
      {entries.map((ad) => <InlineAdCard key={ad._id} ad={ad} />)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Business card (unchanged)
───────────────────────────────────────────────────────── */
function BusinessCard({ biz }) {
  return (
    <Link
      to={`/directory?id=${biz._id}`}
      className="card card-hover biz-card"
      style={{ textDecoration: 'none', display: 'flex' }}
    >
      <div className="biz-logo" aria-hidden="true">
        {biz.logo ? (
          <img
            src={biz.logo}
            alt={biz.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
          />
        ) : (
          biz.name ? biz.name.charAt(0).toUpperCase() : 'B'
        )}
      </div>
      <div className="biz-body">
        <div className="biz-top">
          <h3 className="biz-name">{biz.businessName || biz.name}</h3>
          <span className={`tag ${biz.open ? 'tag-open' : 'tag-closed'}`}>
            {biz.open ? 'Open' : 'Closed'}
          </span>
        </div>
        <span className="tag" style={{ marginBottom: 6 }}>{biz.category}</span>
        <div className="meta-row">
          {biz.phone    && <span>📞 {biz.phone}</span>}
          {biz.location && <span>📍 {biz.location}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────
   Job card (unchanged)
───────────────────────────────────────────────────────── */
function JobCard({ job }) {
  return (
    <Link
      to={`/jobs?id=${job._id}`}
      className="card card-hover"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <h3 className="job-card" style={{ marginBottom: 2, fontSize: 15 }}>{job.title}</h3>
      <div className="job-company">{job.company || '—'}</div>
      <div className="job-chips">
        {job.location       && <span className="job-chip">{job.location}</span>}
        {job.employmentType && <span className="job-chip type">{job.employmentType}</span>}
        {job.salary         && <span className="job-chip">{job.salary}</span>}
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────
   Home page
───────────────────────────────────────────────────────── */
export default function Home() {
  const [heroSlides, setHeroSlides] = useState([]);
  const [leftAds,      setLeftAds]      = useState([]);
  const [rightAds,     setRightAds]     = useState([]);
  const [bizList,      setBizList]      = useState([]);
  const [jobs,         setJobs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [featureLoadError, setFeatureLoadError] = useState('');
  const [communityUpdates, setCommunityUpdates] = useState([]);
  const [communityUpdatesNow, setCommunityUpdatesNow] = useState(Date.now());

  useEffect(() => {
    Promise.all([
      publicApi.heroSlides().catch(() => ({ data: [] })),
      publicApi.fetchAds('left').catch(()      => ({ data: [] })),
      publicApi.fetchAds('right').catch(()     => ({ data: [] })),
      publicApi.businesses('limit=6&status=approved').catch(() => ({ data: [] })),
      publicApi.jobs('limit=4&status=published').catch(()       => ({ data: [] })),
    ]).then(([slidesRes, leftRes, rightRes, bizRes, jobsRes]) => {
      console.info('[homepage ads] left API response:', leftRes);
      console.info(`[homepage ads] left ad count: ${(leftRes.data || []).length}`);
      console.info('[homepage ads] right API response:', rightRes);
      console.info(`[homepage ads] right ad count: ${(rightRes.data || []).length}`);
      setHeroSlides(slidesRes.data || []);
      setLeftAds(leftRes.data     || []);
      setRightAds(rightRes.data   || []);
      setBizList(bizRes.data      || []);
      setJobs(jobsRes.data        || []);
    }).catch((error) => {
      console.error('Unable to load homepage features.', error);
      setFeatureLoadError(error.message || 'Homepage features could not be loaded.');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchCommunityUpdates = async () => {
      try {
        const response = await publicApi.communityUpdates();
        if (!mounted) return;
        setCommunityUpdates(response.data || []);
      } catch (error) {
        if (!mounted) return;
        setCommunityUpdates([]);
      }
    };

    fetchCommunityUpdates();
    const refreshTimer = setInterval(() => {
      setCommunityUpdatesNow(Date.now());
      fetchCommunityUpdates();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(refreshTimer);
    };
  }, []);

  return (
    <>
      <HeroSlider slides={heroSlides} />



      {featureLoadError && <p className="homepage-feature-error" role="alert">{featureLoadError}</p>}
      <div className="homepage-container">

        <aside className="ad-sidebar left-sidebar side-ad-column" aria-label="Left side advertisements">
          {!loading && <SideAdSlot ads={leftAds} side="left" />}
        </aside>

      {/* ── EXISTING HOMEPAGE CONTENT (UNCHANGED) ────────── */}
      <main className="main-content">
        <div className="main-col">

          {/* Chamber intro */}
          <section className="section" aria-labelledby="chamber-intro-heading">
            <div className="chamber-intro">
              <div className="chamber-intro-header">
                <div>
                  <div className="chamber-intro-malayalam">
                    തിരൂർ ചംബർ ഓഫ് കൊമ്മേഴ്‌സ്
                  </div>
                </div>
              </div>
              <div className="chamber-intro-copy">
                <p>
                  തിരൂർ ചംബർ ഓഫ് കൊമ്മേഴ്സ് എന്നത് പ്രാദേശിക വ്യവസായികൾ, വ്യാപാരികൾ,
                  സര്വീസുകൾ നൽകുന്ന സ്ഥാപനങ്ങൾ, പ്രൊഫഷണലുകൾ എന്നിവർക്കായി പണം, വിശ്വാസം,
                  തിളക്കം, പങ്കാളിത്തം എന്നിവ അടിസ്ഥാനമാക്കി ഉണ്ടായിരിക്കുന്ന ഒരു സമുച്ചയവും
                  കൂട്ടായ്മയും ആയിരിക്കുന്നു. ഇവിടെ നിങ്ങളുടെ ബിസിനസ് കാണപ്പെടുകയും പ്രാദേശിക
                  അവസരങ്ങൾ കണ്ടെത്തുകയും ചെയ്യാം.
                </p>
              </div>
            </div>
          </section>

          {!loading && (
            <InlineAdStrip leftAds={leftAds} rightAds={rightAds} />
          )}

          {/* Quick category grid */}
          <section className="section" aria-labelledby="cats-heading">
            <div className="section-head">
              <h2 id="cats-heading">Browse Categories</h2>
              <Link to="/directory">See all →</Link>
            </div>
            <div className="quick-grid" role="list">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.q}
                  to={`/directory?category=${encodeURIComponent(c.q)}`}
                  className="quick-item"
                  role="listitem"
                >
                  <span className="quick-icon" aria-hidden="true">{c.icon}</span>
                  {c.label}
                </Link>
              ))}
            </div>
          </section>

          {/* {heroSlides.length > 0 && (
            <section className={`home-featured-section${heroSlides.length === 1 ? ' home-featured-section--single' : ''}`}>
              <h2 className="home-featured-title">Featured on Tirur Connect</h2>
              <div className="home-featured-slider">
                <HeroSlider slides={heroSlides} />
              </div>
            </section>
          )} */}

             <section className="community-updates-section" aria-labelledby="community-updates-heading">
            <h2 id="community-updates-heading">Community Updates</h2>
            <div className="community-updates-list" aria-live="polite">
              {communityUpdates.map((item) => (
                <article className="community-update-item" key={item._id}>
                  <div className="community-update-icon" aria-hidden="true">{item.icon}</div>
                  <div className="community-update-content">
                    <div className="community-update-text">{item.text}</div>
                    <time className="community-update-time" dateTime={item.createdAt}>
                      {relativeTime(item.createdAt, communityUpdatesNow)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Featured Businesses */}
          {/* <section className="section" aria-labelledby="biz-heading">
            <div className="section-head">
              <h2 id="biz-heading">Featured Businesses</h2>
              <Link to="/directory">View all →</Link>
            </div>
            {loading ? (
              <div className="spinner-wrap">
                <div className="spinner" aria-label="Loading businesses" />
              </div>
            ) : bizList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏪</div>
                <h3>No businesses yet</h3>
                <p>
                  Be the first to <Link to="/list-business">list your business</Link> — it&apos;s free!
                </p>
              </div>
            ) : (
              <div className="grid" role="list">
                {bizList.map((b) => <BusinessCard key={b._id} biz={b} />)}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/list-business" className="btn btn-outline">
                + List Your Business <span className="nav-badge">FREE</span>
              </Link>
            </div>
          </section> */}

          {/* Latest Jobs */}
          {/* <section className="section" aria-labelledby="jobs-heading">
            <div className="section-head">
              <h2 id="jobs-heading">Latest Jobs</h2>
              <Link to="/jobs">View all →</Link>
            </div>
            {loading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : jobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💼</div>
                <h3>No jobs posted yet</h3>
                <p>Check back soon for local opportunities.</p>
              </div>
            ) : (
              <div className="grid" role="list">
                {jobs.map((j) => <JobCard key={j._id} job={j} />)}
              </div>
            )}
          </section> */}

          {/* Business listing and chamber membership options */}
          <section className="section chamber-listing-section" aria-labelledby="chamber-cta">
            <h2 id="chamber-cta" className="chamber-listing-heading">
              Get Listed on Tirur Connect
            </h2>
            <div className="chamber-listing-grid">
              <article className="chamber-listing-card">
                <span className="chamber-listing-badge">FREE</span>
                <h3>📋 List Your Business / Number</h3>
                <p>
                  നിങ്ങളുടെ കടയും സേവനങ്ങളും തിരൂർ കണക്ടിൽ ലിസ്റ്റ് ചെയ്യൂ. Quick form, reviewed by an
                  admin, then published to the public directory. No payment needed.
                </p>
                <Link to="/list-business" className="chamber-listing-button chamber-listing-button--free">
                  List for Free <span aria-hidden="true">→</span>
                </Link>
              </article>

              <article className="chamber-listing-card chamber-listing-card--premium">
                <span className="chamber-listing-badge chamber-listing-badge--premium">
                  PAID · PREMIUM
                </span>
                <h3>🏅 Chamber of Commerce Membership</h3>
                <p>
                  Priority directory placement, post unlimited jobs, access verified candidate
                  resumes, and homepage ad slots with an active paid membership.
                </p>
                <Link to="/membership" className="chamber-listing-button chamber-listing-button--premium">
                  Become a Member <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </section>

        </div>
      </main>

        <aside className="ad-sidebar right-sidebar side-ad-column" aria-label="Right side advertisements">
          {!loading && <SideAdSlot ads={rightAds} side="right" />}
        </aside>
      </div>
    </>
  );
}
