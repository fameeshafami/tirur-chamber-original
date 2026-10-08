import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast.jsx';

const PLANS = [
  { value: 'Silver - ₹2,500/yr', name: 'Silver', price: '₹2,500 / year', detail: 'Directory listing and basic membership' },
  { value: 'Gold - ₹5,000/yr', name: 'Gold', price: '₹5,000 / year', detail: 'Job postings and candidate CV access' },
  { value: 'Platinum - ₹10,000/yr', name: 'Platinum', price: '₹10,000 / year', detail: 'Homepage advertisement eligibility' },
];

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

export default function MembershipApplication() {
  const toast = useToast();
  const { isLoggedIn, isShopOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [business, setBusiness] = useState(null);
  const [membership, setMembership] = useState(null);
  const [plan, setPlan] = useState(PLANS[0].value);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !isShopOwner) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([apiRequest('/shop-owner/business'), apiRequest('/shop-owner/membership')])
      .then(([businessResult, membershipResult]) => {
        if (!active) return;
        setBusiness(businessResult.business || null);
        setMembership(membershipResult.membership || null);
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load membership information.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isLoggedIn, isShopOwner]);

  async function submitApplication(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const orderResult = await apiRequest('/shop-owner/membership/payment/order', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });

      if (!orderResult.mock) {
        await loadRazorpay();
        const payment = await new Promise((resolve, reject) => {
          const checkout = new window.Razorpay({
            key: orderResult.keyId,
            amount: orderResult.order.amount,
            currency: orderResult.order.currency,
            name: 'Tirur Chamber of Commerce',
            description: `${plan} membership application`,
            prefill: { name: business?.ownerName, email: business?.email, contact: business?.phone },
            theme: { color: '#7c7ebd' },
            handler: resolve,
            modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
          });
          checkout.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
          checkout.open();
        });
        await apiRequest('/shop-owner/membership/payment/verify', { method: 'POST', body: JSON.stringify(payment) });
      }

      const result = await apiRequest('/shop-owner/membership', {
        method: 'POST',
        body: JSON.stringify({ plan, paymentOrderId: orderResult.order.id }),
      });
      setMembership(result.membership);
      toast('Membership application submitted for review.', 'success');
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit your membership application.');
      toast(requestError.message || 'Unable to submit your membership application.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return <section className="section"><div className="container membership-page"><div className="membership-panel"><h1>Chamber Membership</h1><p className="text-soft">Sign in with a Shop Owner account to apply for paid Chamber membership.</p><Link to="/login?register=shop_owner" className="btn btn-primary">Sign in or create an account</Link></div></div></section>;
  }

  if (!isShopOwner) {
    return <section className="section"><div className="container membership-page"><div className="membership-panel"><h1>Chamber Membership</h1><p className="text-soft">Membership applications are available to Shop Owner accounts.</p><Link to="/directory" className="btn btn-outline">Return to directory</Link></div></div></section>;
  }

  return (
    <section className="section"><div className="container membership-page">
      <header className="membership-heading"><span className="about-eyebrow">തിരൂർ ചാംബർ ഓഫ് കൊമേഴ്സ്</span><h1>Chamber of Commerce Membership</h1><p className="text-soft">Apply for paid membership, track approval, and activate your public QR profile.</p></header>
      {loading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading membership information" /></div> : error && !business ? <div className="alert alert-danger" role="alert">{error}</div> : !business ? <div className="membership-panel"><h2>Create a business profile first</h2><p className="text-soft">Your membership application uses the business details already saved to your Shop Owner account.</p><Link to="/shop-owner" className="btn btn-primary">Set up business profile</Link></div> : membership ? <div className="membership-panel">
        <div className="membership-status-heading"><div><h2>Your application</h2><p className="text-soft">{membership.businessName} · {membership.plan}</p></div><span className={`status ${membership.status === 'active' ? 'active' : membership.status === 'rejected' || membership.status === 'suspended' ? 'declined' : 'pending'}`}>{membership.status}</span></div>
        <p>{membership.status === 'pending' ? 'Your paid membership application is awaiting Chamber review.' : membership.status === 'active' ? `Your membership is active${membership.membershipExpiryDate ? ` until ${new Date(membership.membershipExpiryDate).toLocaleDateString('en-IN')}` : ''}.` : `Your membership status is ${membership.status}. Please contact the Chamber office for assistance.`}</p>
        {membership.status === 'active' && <Link to="/chamber-member" className="btn btn-primary">Open member dashboard</Link>}
      </div> : <div className="membership-layout">
        <form className="membership-panel membership-form" onSubmit={submitApplication}>
          <h2>New membership application</h2>
          <p className="text-soft">Business information is taken from your saved profile.</p>
          <dl className="chamber-details">
            {[
              ['Business', business.name], ['Owner', business.ownerName], ['Email', business.email],
              ['Phone', business.phone], ['Category', business.category],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
          </dl>
          <label>Membership plan<select value={plan} onChange={(event) => setPlan(event.target.value)}>{PLANS.map((item) => <option value={item.value} key={item.name}>{item.name} — {item.price}</option>)}</select></label>
          <div className="membership-plan-detail">{PLANS.find((item) => item.value === plan)?.detail}</div>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Processing…' : 'Continue to payment'}</button>
          <p className="text-soft membership-footnote">Payment is processed securely. Your application will be reviewed after successful payment.</p>
        </form>
        <aside className="membership-panel membership-aside"><h2>Included with membership</h2><ul><li>Verified Chamber member profile and QR identity</li><li>Priority business directory placement</li><li>Job posting and candidate CV eligibility</li><li>Advertisement eligibility based on plan</li></ul><p className="text-soft">Need a free basic listing instead? <Link to="/list-business">List your business for free.</Link></p></aside>
      </div>}
    </div></section>
  );
}
