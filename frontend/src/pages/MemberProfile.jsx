import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicApi } from '../lib/api';

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
  : 'Not provided';

export default function MemberProfile() {
  const [searchParams] = useSearchParams();
  const publicId = searchParams.get('publicId');
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!publicId) {
      setMember(null);
      setError('This QR link is missing its public verification ID.');
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    publicApi.memberPublic(publicId)
      .then((result) => {
        if (active) setMember(result.member || null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to verify this membership.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [publicId]);

  if (loading) {
    return <div className="verify-page"><div className="member-profile-card" role="status">Verifying Chamber membership…</div></div>;
  }

  if (error || !member) {
    return (
      <div className="verify-page">
        <div className="member-profile-card" role="alert">
          <div className="empty-icon" aria-hidden="true">🔒</div>
          <h1>Membership verification unavailable</h1>
          <p>{error || 'No Chamber membership was found for this QR code.'}</p>
          <Link className="btn btn-outline" to="/directory">View directory</Link>
        </div>
      </div>
    );
  }

  const verified = member.verified === true;
  const profileUrl = window.location.href;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=1&data=${encodeURIComponent(profileUrl)}`;
  const details = [
    ['Business owner', member.ownerName],
    ['Category', member.category],
    ['Phone', member.phone],
    ['Email', member.email],
    ['Address', member.address],
    ['Membership number', member.membershipNumber],
    ['Member since', formatDate(member.membershipStartDate)],
    ['Valid until', formatDate(member.membershipExpiryDate)],
  ];

  return (
    <main className="verify-page">
      <article className="member-profile-card" aria-labelledby="member-business-name">
        <div className={`verification-banner${verified ? ' is-verified' : ' is-inactive'}`}>
          {verified ? '✓ CHAMBER VERIFIED' : `${String(member.status || 'inactive').toUpperCase()} MEMBERSHIP`}
        </div>
        <header className="member-profile-head">
          <div className="member-avatar" aria-hidden="true">
            {member.logo
              ? <img src={member.logo} alt="" />
              : '🏪'}
          </div>
          <div className="member-head-text">
            <h1 id="member-business-name">{member.businessName || 'Chamber Member'}</h1>
            <p>{member.category || 'Business'} · Tirur Chamber of Commerce</p>
          </div>
        </header>

        <div className="qr-card member-profile-qr">
          <img src={qrUrl} alt="QR code for this public membership profile" />
          <div>
            <strong>{member.membershipNumber || 'Membership number pending'}</strong>
            <p>Scan to verify this public Chamber profile.</p>
          </div>
        </div>

        {member.description && <p className="member-profile-description">{member.description}</p>}

        <dl className="member-details-grid">
          {details.map(([label, value]) => (
            <div className="member-detail-item" key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Not provided'}</dd>
            </div>
          ))}
          {member.website && (
            <div className="member-detail-item">
              <dt>Website</dt>
              <dd><a href={member.website} target="_blank" rel="noopener noreferrer">{member.website}</a></dd>
            </div>
          )}
        </dl>

        <p className="member-profile-privacy">
          This public verification profile does not display account credentials, payment records, or private documents.
        </p>
        <div className="member-profile-actions">
          <button className="btn btn-primary" type="button" onClick={() => window.print()}>Print profile</button>
          <Link className="btn btn-outline" to="/directory">View directory</Link>
        </div>
      </article>
    </main>
  );
}