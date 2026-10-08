import { useEffect, useRef, useState } from 'react';
import { adminApi, apiRequest } from '../lib/api';
import { convertImageLink } from '../lib/imageLink.js';
import { useToast } from '../components/Toast.jsx';
import PasswordVisibilityToggle from '../components/PasswordVisibilityToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PANELS = [
  ['overview', ' Overview'],
  ['chamber-approvals', ' Membership approvals'],
  ['job-approvals', ' Job approvals'],
  ['business-approvals', ' Business approvals'],
  ['admin-management', ' Admin Management'],
  ['admin-work', ' Admin work overview'],
  ['admin-activity', ' Admin activity'],
  // ['system-settings', '⚙️ System Settings'],
  ['users', ' Users'],
  ['listings', ' Free listings'],
  ['members', ' Chamber membership'],
  ['qr-directory', ' QR Directory'],
  ['directory', ' Directory'],
  ['jobs', ' Jobs'],
  ['applications', ' Applications'],
  ['resumes', ' Chamber documents'],
  ['news', ' News'],
  ['community-updates', ' Community updates'],
  ['offers', ' Offers'],
  ['hero-slider', ' Hero Slider'],
  ['ads', ' Ads'],
  ['reports', ' Reports'],
];

const ADMIN_PERMISSION_OPTIONS = [
  ['dashboard', 'Dashboard'],
  ['chamberMembership', 'Chamber Membership'],
  ['chamberApprovals', 'Chamber Membership Approval'],
  ['chamberDocuments', 'Chamber Member Documents'],
  ['qrCodes', 'QR Codes'],
  ['jobs', 'Jobs'],
  ['jobApprovals', 'Job Approvals'],
  ['jobApplications', 'Job Applications'],
  ['businesses', 'Business Listings'],
  ['businessApprovals', 'Business Approvals'],
  ['news', 'News'],
  ['advertisements', 'Advertisements'],
  ['offers', 'Offers'],
  ['users', 'Users'],
  ['reports', 'Reports'],
];

const newAdminDraft = () => ({
  name: '', email: '', phone: '', password: '', confirmPassword: '', status: 'active',
  permissions: Object.fromEntries(ADMIN_PERMISSION_OPTIONS.map(([key]) => [key, key === 'dashboard'])),
});

const COMMUNITY_UPDATE_CATEGORIES = [
  ['shops_joined', '🏪 Shops joined'],
  ['hirings', '💼 Hirings'],
  ['active_members', '🏆 Active members'],
  ['ad_slots', '📢 Ad slots'],
  ['events', '🎉 Events'],
  ['announcements', '📰 Announcements'],
  ['offers', '🛒 Offers'],
  ['general', '📌 General'],
];
const COMMUNITY_UPDATE_ICONS = Object.fromEntries(COMMUNITY_UPDATE_CATEGORIES.map(([category, label]) => [category, label.split(' ')[0]]));
const newCommunityUpdateDraft = () => ({
  category: 'general', customCategory: '', text: '', icon: '📌', status: 'active', startAt: '', endAt: '',
});

const initialData = {
  stats: null,
  admins: [],
  adminWork: null,
  adminActivity: [],
  systemSettings: null,
  myActivity: [],
  myCompletedToday: 0,
  reports: null,
  users: [],
  businesses: [],
  members: [],
  memberQrCodes: [],
  jobs: [],
  applications: [],
  resumes: [],
  news: [],
  communityUpdates: [],
  offers: [],
  ads: [],
  heroSlides: [],
};

const localDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function normalizedAdSide(ad) {
  const raw = String(ad.side || ad.position || ad.placement || '').trim().toLowerCase();
  if (raw === 'left' || raw === 'sidebar-left') return 'left';
  if (raw === 'right' || raw === 'sidebar-right') return 'right';
  if (raw === 'homepage' || raw === 'directory') return raw;
  return '';
}

function kolkataDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function adminAdStatus(ad) {
  if (ad.enabled === false || ad.status === 'unpublished') return ['Disabled', 'disabled'];
  const approved = ad.approval_status === 'approved' || ad.approved === true;
  const startDate = kolkataDateKey(ad.startDate || ad.startAt);
  const endDate = kolkataDateKey(ad.endDate || ad.endAt);
  const today = kolkataDateKey(new Date());
  if (endDate && endDate < today) return ['Expired', 'expired'];
  if (startDate && startDate > today) return ['Pending approval', 'pending'];
  if (!approved || ad.status !== 'published') return ['Pending approval', 'pending'];
  return ['Live', 'live'];
}

const newAdDraft = () => {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    title: '', adTitle: '', subtitle: '', description: '', content: '', category: 'Other', badge: 'LIVE',
    placement: 'sidebar-left', side: 'left', imageUrl: '', image_url: '', image_source: 'upload',
    imageMethod: 'upload', imageLinkReady: false, copy_linked_image: true,
    link: '', order: 0, sideOrder: '', status: 'draft', enabled: true,
    startAt: localDateTime(start), endAt: localDateTime(end),
  };
};
const newHeroSlideDraft = () => ({
  desktopImage: '', image_url: '', image_source: 'upload', imageMethod: 'upload', imageLinkReady: false,
  wideImage: '', wide_image_url: '', wide_image_source: 'upload', wideImageMethod: 'upload', wideImageLinkReady: false,
  mobileImage: '', mobile_image_url: '', mobile_image_source: 'upload', mobileImageMethod: 'upload', mobileImageLinkReady: false,
  copy_linked_image: true, altText: '', show_text: false, title: '', description: '', subtitle: '',
  buttonText: '', buttonLink: '', order: 0, active: false,
  startDate: localDateTime(), endDate: localDateTime(new Date(Date.now() + 30 * 86400000)),
});

function imageDataUrl(file, { maxBytes, label }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error(`${label} must be a JPG, PNG or WebP image.`));
  }
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`${label} must be under ${Math.round(maxBytes / 1024)} KB.`));
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Unable to read the ${label.toLowerCase()} file.`));
      reader.readAsDataURL(file);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to decode the ${label.toLowerCase()} file.`));
    };
    image.src = objectUrl;
  });
}

function ImageMethodField({
  label, uploadValue, urlValue, method, setMethod, setUrlValue,
  urlReady, setUrlReady, recommendedWidth, recommendedHeight, onUpload,
}) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadError, setLoadError] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');
  const [linkWarning, setLinkWarning] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [dimensions, setDimensions] = useState(null);
  const requestId = useRef(0);
  const linkInputRef = useRef(null);
  const selectedLink = useRef('');
  const selectedUrl = method === 'url' && previewUrl ? previewUrl : '';
  const selectedUpload = method === 'upload' ? uploadValue : '';
  const previewSource = selectedUpload || selectedUrl;

  async function loadImageLink(value = linkInputRef.current?.value || urlValue) {
    const inputUrl = String(value || '').trim();
    const conversion = convertImageLink(inputUrl);
    setLoadError('');
    setLinkWarning('');
    setLinkNote('');
    setDimensions(null);
    setLoading(false);
    selectedLink.current = '';
    const activeRequest = requestId.current + 1;
    requestId.current = activeRequest;
    if (conversion.error) {
      setUrlValue(inputUrl);
      setLoadError(conversion.error);
      setUrlReady(false);
      setPreviewUrl('');
      return;
    }
    setUrlValue(conversion.url);
    setConvertedUrl(conversion.url);
    setLinkWarning(conversion.warning || '');
    setLinkNote(conversion.note || '');
    selectedLink.current = conversion.url;
    setLoading(true);
    setUrlReady(false);
    setPreviewUrl('');
    try {
      const probe = await adminApi.probeImageLink(conversion.url);
      if (activeRequest !== requestId.current) return;
      const resolvedUrl = probe.url || conversion.url;
      setUrlValue(resolvedUrl);
      setConvertedUrl(resolvedUrl);
      selectedLink.current = resolvedUrl;
      if (probe.warning) setLinkWarning(probe.warning);
      if (probe.note) setLinkNote(probe.note);
      setPreviewUrl(probe.previewDataUrl || resolvedUrl);
      if (probe.width && probe.height) setDimensions({ width: probe.width, height: probe.height });
      setUrlReady(true);
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      setUrlReady(false);
      setPreviewUrl('');
      setLoadError(error.message || 'Could not load this image. Try “Copy image address” from the full-size preview, or turn on “Copy linked image to my server” when saving.');
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }

  function updateDimensions(event) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!dimensions) setDimensions({ width: naturalWidth, height: naturalHeight });
    if (method === 'upload') setLoading(false);
  }

  function failPreview(event) {
    if (method !== 'upload' || Number(event.currentTarget.dataset.requestId) !== requestId.current) return;
    setLoading(false);
    setUrlReady(false);
    setPreviewUrl('');
    setLoadError('Could not load this image from the uploaded file.');
  }

  function switchMethod(nextMethod) {
    if (loading) {
      requestId.current += 1;
      setLoading(false);
      setUrlReady(false);
    }
    setLoadError('');
    setMethod(nextMethod);
  }

  return (
    <div className="image-method-field">
      <span className="image-method-label">{label}</span>
      <div className="image-method-tabs" role="tablist" aria-label={`${label} input method`}>
        <button type="button" role="tab" aria-selected={method === 'upload'} className={method === 'upload' ? 'active' : ''} onClick={() => switchMethod('upload')}>Upload File</button>
        <button type="button" role="tab" aria-selected={method === 'url'} className={method === 'url' ? 'active' : ''} onClick={() => switchMethod('url')}>Image Link</button>
      </div>
      {method === 'upload' ? (
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} />
      ) : (
        <div className="image-link-control">
          <input
            ref={linkInputRef}
            type="text"
            inputMode="url"
            value={urlValue}
            placeholder="https://example.com/image.jpg"
            onPaste={() => window.setTimeout(() => loadImageLink(linkInputRef.current?.value), 0)}
            onBlur={() => {
              const pastedUrl = linkInputRef.current?.value.trim();
              if (pastedUrl && pastedUrl !== selectedLink.current) loadImageLink(pastedUrl);
            }}
            onChange={(event) => {
            setUrlValue(event.target.value);
            setUrlReady(false);
            setPreviewUrl('');
            setLoadError('');
            setConvertedUrl('');
            setLinkWarning('');
            setLinkNote('');
            requestId.current += 1;
            selectedLink.current = '';
            setLoading(false);
          }} />
          <button className="btn btn-outline btn-sm" type="button" onClick={() => loadImageLink()} disabled={!urlValue.trim() || loading}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
      )}
      <div className="image-method-preview">
        {loading && <span className="image-method-spinner" role="status" aria-label="Loading image" />}
        {previewSource && (
          <img
            src={previewSource}
            alt={`${label} preview`}
            onLoad={updateDimensions}
            onError={failPreview}
            referrerPolicy={method === 'url' ? 'no-referrer' : undefined}
            data-request-id={requestId.current}
            key={`${previewSource}:${requestId.current}`}
          />
        )}
        {!previewSource && !loading && <span className="text-soft">Image preview appears here</span>}
      </div>
      {loadError && <p className="image-method-error" role="alert">{loadError}</p>}
      {linkWarning && <p className="image-method-warning" role="status">{linkWarning}</p>}
      {linkNote && <p className="image-method-hint" role="note">{linkNote}</p>}
      {convertedUrl && <p className="image-method-hint image-method-converted-url">Using image URL: <span>{convertedUrl}</span></p>}
      <p className="image-method-hint">
        Recommended: {recommendedWidth} × {recommendedHeight} px
        {dimensions && <> · Detected: {dimensions.width} × {dimensions.height} px
          {Math.abs((dimensions.width / dimensions.height) - (recommendedWidth / recommendedHeight)) > 0.02 && <strong className="image-method-warning"> · Aspect ratio differs from recommendation</strong>}
        </>}
      </p>
      <p className="image-method-hint">Tip: Paste a direct HTTPS image link, a Google Images result link (<code>/imgres</code>), or a Google redirect link — the server will fetch and preview it. Links do not need to end in .jpg, .png, or .webp.</p>
    </div>
  );
}

function EmptyRow({ columns, children }) {
  return <tr><td colSpan={columns} className="text-soft">{children}</td></tr>;
}

function Table({ headings, children }) {
  return (
    <div className="table-wrap admin-table-wrap">
      <table className="data-table">
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function cvBlob(cv) {
  const encoded = String(cv?.file || '').replace(/^data:[^,]+,/, '');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: cv.fileType || 'application/octet-stream' });
}

export default function AdminDashboard() {
  const toast = useToast();
  const { user, canAccessAdminSection } = useAuth();
  const [panel, setPanel] = useState('overview');
  const [approvalStatus, setApprovalStatus] = useState('pending');
  const [approvalReasons, setApprovalReasons] = useState({});
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newsDraft, setNewsDraft] = useState({ title: '', category: '', description: '', image: '', content: '', status: 'draft' });
  const [editingNews, setEditingNews] = useState('');
  const [communityUpdateDraft, setCommunityUpdateDraft] = useState(newCommunityUpdateDraft);
  const [editingCommunityUpdate, setEditingCommunityUpdate] = useState('');
  const [offerDraft, setOfferDraft] = useState({ title: '', category: 'offers', description: '', image: '', link: '', startDate: '', endDate: '', status: 'draft' });
  const [editingOffer, setEditingOffer] = useState('');
  const [adDraft, setAdDraft] = useState(newAdDraft);
  const [editingAd, setEditingAd] = useState('');
  const [heroSlideDraft, setHeroSlideDraft] = useState(newHeroSlideDraft);
  const [editingHeroSlide, setEditingHeroSlide] = useState('');
  const [adminDraft, setAdminDraft] = useState(newAdminDraft);
  const [adminCreateError, setAdminCreateError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfirmAdminPassword, setShowConfirmAdminPassword] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [activityFilters, setActivityFilters] = useState({ section: '', action: '', status: '', date: '' });
  const [viewingAdmin, setViewingAdmin] = useState(null);

  const adminSections = {
    overview: 'dashboard',
    'chamber-approvals': 'chamberApprovals',
    'job-approvals': 'jobApprovals',
    'business-approvals': 'businessApprovals',
    users: 'users',
    listings: 'businesses',
    members: 'chamberMembership',
    'qr-directory': 'qrCodes',
    directory: 'businesses',
    jobs: 'jobs',
    applications: 'jobApplications',
    resumes: 'chamberDocuments',
    news: 'news',
    'community-updates': 'news',
    offers: 'offers',
    'hero-slider': 'advertisements',
    ads: 'advertisements',
    reports: 'reports',
  };

  const visiblePanels = PANELS.filter(([key]) => ['admin-management', 'admin-work', 'admin-activity', 'system-settings'].includes(key)
    ? user?.role === 'super_admin'
    : canAccessAdminSection(adminSections[key]));

  useEffect(() => {
    if (!visiblePanels.some(([key]) => key === panel)) {
      setPanel(visiblePanels[0]?.[0] || '');
    }
  }, [panel, visiblePanels]);

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      const allowed = (section) => canAccessAdminSection(section);
      const empty = { data: [] };
      const [stats, admins, adminWork, adminActivity, myActivity, systemSettings, users, businesses, members, memberQrCodes, jobs, applications, resumes, news, communityUpdates, offers, ads, heroSlides, reports] = await Promise.all([
        allowed('dashboard') ? (user?.role === 'super_admin' ? adminApi.superDashboard() : adminApi.dashboard()) : Promise.resolve(null),
        user?.role === 'super_admin' ? adminApi.admins() : Promise.resolve(empty),
        user?.role === 'super_admin' ? adminApi.adminWork() : Promise.resolve(null),
        Promise.resolve(empty),
        user?.role === 'admin' ? adminApi.myActivity('limit=10') : Promise.resolve({ ...empty, completedToday: 0 }),
        user?.role === 'super_admin' ? adminApi.systemSettings() : Promise.resolve(null),
        allowed('users') ? adminApi.users('limit=100') : Promise.resolve(empty),
        allowed('businesses') || allowed('businessApprovals') ? adminApi.businesses('limit=100') : Promise.resolve(empty),
        allowed('chamberMembership') || allowed('chamberApprovals') ? adminApi.members('limit=100') : Promise.resolve(empty),
        allowed('qrCodes') ? adminApi.allMembersQr() : Promise.resolve(empty),
        allowed('jobs') || allowed('jobApprovals') ? adminApi.jobs('limit=100') : Promise.resolve(empty),
        allowed('jobApplications') ? adminApi.applications('limit=100') : Promise.resolve(empty),
        allowed('chamberDocuments') ? apiRequest('/resumes') : Promise.resolve(empty),
        allowed('news') ? adminApi.news('limit=100') : Promise.resolve(empty),
        allowed('news') ? adminApi.communityUpdates('limit=100') : Promise.resolve(empty),
        allowed('offers') ? adminApi.offers('limit=100') : Promise.resolve(empty),
        allowed('advertisements') ? adminApi.ads('limit=100') : Promise.resolve(empty),
        allowed('advertisements') ? adminApi.heroSlides() : Promise.resolve(empty),
        allowed('reports') ? adminApi.reports() : Promise.resolve(null),
      ]);
      setData({
        stats,
        admins: admins.data || [],
        adminWork,
        adminActivity: adminActivity.data || [],
        myActivity: myActivity.data || [],
        myCompletedToday: myActivity.completedToday || 0,
        systemSettings,
        reports,
        users: users.data || [],
        businesses: businesses.data || [],
        members: members.data || [],
        memberQrCodes: memberQrCodes.data || [],
        jobs: jobs.data || [],
        applications: applications.data || [],
        resumes: resumes.data || [],
        news: news.data || [],
        communityUpdates: communityUpdates.data || [],
        offers: offers.data || [],
        ads: ads.data || [],
        heroSlides: heroSlides.data || [],
      });
    } catch (error) {
      setLoadError(error.message || 'Unable to load admin dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  async function updateAdminPermissions(adminId, permissionKey, nextValue) {
    const targetAdmin = data.admins.find((admin) => admin._id === adminId);
    const nextPermissions = {
      ...(targetAdmin?.permissions || {}),
      [permissionKey]: nextValue,
    };

    await runAction(
      () => adminApi.updateAdminPermissions(adminId, nextPermissions),
      'Admin permissions updated.',
    );
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    const params = new URLSearchParams({ limit: '100' });
    if (selectedAdminId) params.set('adminId', selectedAdminId);
    Object.entries(activityFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    adminApi.adminActivity(params.toString())
      .then((result) => setData((current) => ({ ...current, adminActivity: result.data || [] })))
      .catch((error) => setLoadError(error.message || 'Unable to load admin activity.'));
  }, [selectedAdminId, activityFilters, user]);

  async function createAdmin(event) {
    event.preventDefault();
    setAdminCreateError('');
    if (adminDraft.password !== adminDraft.confirmPassword) {
      setAdminCreateError('Passwords do not match.');
      return;
    }
    try {
      const { confirmPassword, ...body } = adminDraft;
      await adminApi.createAdmin(body);
      toast('Admin account created.', 'success');
      setAdminDraft(newAdminDraft());
      await loadData();
    } catch (error) {
      setAdminCreateError(error.message || 'Unable to create admin account.');
    }
  }

  function editAdmin(admin) {
    const name = window.prompt('Admin name:', admin.name);
    if (name === null) return;
    const email = window.prompt('Admin email:', admin.email);
    if (email === null) return;
    const phone = window.prompt('Admin phone:', admin.phone || '');
    if (phone === null) return;
    runAction(() => adminApi.updateAdmin(admin._id, { name, email, phone }), 'Admin details updated.');
  }

  async function runAction(action, message) {
    try {
      await action();
      toast(message, 'success');
      await loadData();
      return true;
    } catch (error) {
      toast(error.message || 'The action could not be completed.', 'error');
      return false;
    }
  }

  async function updateApprovalStatus(type, item, status) {
    const reasonKey = `${type}:${item._id}`;
    const rejectionReason = (approvalReasons[reasonKey] || '').trim();
    if (status === 'rejected' && !rejectionReason) {
      toast('Enter a reason before rejecting this submission.', 'error');
      return;
    }

    const action = type === 'business'
      ? () => adminApi.updateBizStatus(item._id, status, rejectionReason)
      : type === 'membership'
        ? () => status === 'approved'
          ? adminApi.approveMember(item._id)
          : adminApi.rejectMember(item._id, rejectionReason)
        : () => adminApi.updateJobStatus(item._id, status === 'approved' ? 'published' : 'rejected', rejectionReason);
    const label = type === 'business' ? 'Business listing' : type === 'membership' ? 'Membership' : 'Job';
    const succeeded = await runAction(action, `${label} ${status === 'approved' ? 'approved' : 'rejected'}.`);
    if (succeeded) {
      setApprovalReasons((current) => {
        const next = { ...current };
        delete next[reasonKey];
        return next;
      });
    }
  }

  async function openCv(path) {
    const preview = window.open('', '_blank');
    if (!preview) {
      toast('Please allow pop-ups to view the CV.', 'error');
      return;
    }
    preview.document.write('<p style="font-family:sans-serif;padding:24px">Loading CV…</p>');
    try {
      const result = await apiRequest(path);
      const url = URL.createObjectURL(cvBlob(result.cv));
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      preview.close();
      toast(error.message || 'Unable to load CV.', 'error');
    }
  }

  async function saveNews(event, publish = false) {
    event.preventDefault();
    const body = { ...newsDraft, status: publish ? 'published' : newsDraft.status };
    await runAction(
      () => editingNews ? adminApi.updateNews(editingNews, body) : adminApi.createNews(body),
      editingNews ? 'News updated.' : 'News saved.',
    );
    setEditingNews('');
    setNewsDraft({ title: '', category: '', description: '', image: '', content: '', status: 'draft' });
  }

  async function saveCommunityUpdate(event) {
    event.preventDefault();
    const body = {
      category: communityUpdateDraft.category === 'custom'
        ? communityUpdateDraft.customCategory.trim()
        : communityUpdateDraft.category,
      text: communityUpdateDraft.text.trim(),
      icon: communityUpdateDraft.icon.trim(),
      status: communityUpdateDraft.status,
      startAt: communityUpdateDraft.startAt || null,
      endAt: communityUpdateDraft.endAt || null,
    };
    await runAction(
      () => editingCommunityUpdate
        ? adminApi.updateCommunityUpdate(editingCommunityUpdate, body)
        : adminApi.createCommunityUpdate(body),
      editingCommunityUpdate ? 'Community update saved.' : 'Community update created.',
    );
    setEditingCommunityUpdate('');
    setCommunityUpdateDraft(newCommunityUpdateDraft());
  }

  async function saveOffer(event, publish = false) {
    event.preventDefault();
    const body = { ...offerDraft, status: publish ? 'published' : offerDraft.status };
    await runAction(
      () => editingOffer ? adminApi.updateOffer(editingOffer, body) : adminApi.createOffer(body),
      editingOffer ? 'Offer updated.' : 'Offer saved.',
    );
    setEditingOffer('');
    setOfferDraft({ title: '', category: 'offers', description: '', image: '', link: '', startDate: '', endDate: '', status: 'draft' });
  }

  async function saveAd(event) {
    event.preventDefault();
    const usingUrl = adDraft.imageMethod === 'url';
    if (usingUrl ? (!adDraft.image_url || !adDraft.imageLinkReady) : !adDraft.imageUrl) {
      toast(usingUrl ? 'Load the image link successfully before saving.' : 'Upload an advertiser image before saving.', 'error');
      return;
    }
    if (!adDraft.link) {
      toast('Add the advertiser destination link before saving.', 'error');
      return;
    }
    const body = {
      ...adDraft,
      adTitle: adDraft.adTitle.trim(),
      description: adDraft.description.trim(),
      sideOrder: adDraft.sideOrder ? Number(adDraft.sideOrder) : null,
      side: adDraft.side,
      placement: adDraft.side === 'left' ? 'sidebar-left' : adDraft.side === 'right' ? 'sidebar-right' : adDraft.side,
      image_source: adDraft.imageMethod,
      imageUrl: usingUrl ? '' : adDraft.imageUrl,
      image_url: usingUrl ? adDraft.image_url.trim() : '',
      copy_linked_image: usingUrl && adDraft.copy_linked_image,
      order: Number(adDraft.order) || 0,
      status: 'draft',
    };
    delete body.imageMethod;
    delete body.imageLinkReady;
    const succeeded = await runAction(
      () => editingAd ? adminApi.updateAd(editingAd, body) : adminApi.createAd(body),
      editingAd ? 'Advertisement updated and sent for approval.' : 'Advertisement submitted for approval.',
    );
    if (succeeded) {
      setEditingAd('');
      setAdDraft(newAdDraft());
    }
  }

  async function saveHeroSlide(event) {
    event.preventDefault();
    const imageFields = [
      ['desktopImage', 'image_url', 'image_source', 'imageMethod', 'imageLinkReady', true],
      ['wideImage', 'wide_image_url', 'wide_image_source', 'wideImageMethod', 'wideImageLinkReady', false],
      ['mobileImage', 'mobile_image_url', 'mobile_image_source', 'mobileImageMethod', 'mobileImageLinkReady', false],
    ];
    for (const [uploadKey, urlKey, , methodKey, readyKey, required] of imageFields) {
      const usingUrl = heroSlideDraft[methodKey] === 'url';
      if (usingUrl && heroSlideDraft[urlKey] && !heroSlideDraft[readyKey]) {
        toast(`Load the ${uploadKey.replace('Image', '').toLowerCase()} image link successfully before saving.`, 'error');
        return;
      }
      if (required && (usingUrl ? !heroSlideDraft[urlKey] || !heroSlideDraft[readyKey] : !heroSlideDraft[uploadKey])) {
        toast('Choose a desktop image file or load a desktop image link before saving.', 'error');
        return;
      }
    }
    const body = {
      ...heroSlideDraft,
      show_text: heroSlideDraft.show_text === true,
      title: heroSlideDraft.title.replace(/<[^>]*>/g, '').trim().slice(0, 80),
      description: heroSlideDraft.description.replace(/<[^>]*>/g, '').trim().slice(0, 160),
      subtitle: heroSlideDraft.description.replace(/<[^>]*>/g, '').trim().slice(0, 160),
      order: Number(heroSlideDraft.order) || 0,
    };
    imageFields.forEach(([uploadKey, urlKey, sourceKey, methodKey, readyKey]) => {
      const usingUrl = heroSlideDraft[methodKey] === 'url';
      body[sourceKey] = usingUrl ? 'url' : 'upload';
      body[uploadKey] = usingUrl ? '' : heroSlideDraft[uploadKey];
      body[urlKey] = usingUrl ? heroSlideDraft[urlKey].trim() : '';
      delete body[methodKey];
      delete body[readyKey];
    });
    const succeeded = await runAction(
      () => editingHeroSlide ? adminApi.updateHeroSlide(editingHeroSlide, body) : adminApi.createHeroSlide(body),
      editingHeroSlide ? 'Hero slide updated.' : 'Hero slide created.',
    );
    if (succeeded) {
      setEditingHeroSlide('');
      setHeroSlideDraft(newHeroSlideDraft());
    }
  }

  async function updateImageUpload(event, setDraft, field, methodField, sourceField, readyField, label) {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      const value = await imageDataUrl(file, { maxBytes: 2 * 1024 * 1024, label });
      setDraft((current) => ({
        ...current,
        [field]: value,
        [methodField]: 'upload',
        [sourceField]: 'upload',
        [readyField]: false,
      }));
    } catch (error) {
      toast(error.message, 'error');
      event.target.value = '';
    }
  }

  async function moveHeroSlide(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const reordered = [...data.heroSlides];
    const fromIndex = reordered.findIndex((slide) => slide._id === draggedId);
    const toIndex = reordered.findIndex((slide) => slide._id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setData((current) => ({ ...current, heroSlides: reordered }));
    await runAction(
      () => adminApi.reorderHeroSlides(reordered.map((slide) => slide._id)),
      'Hero slide order updated.',
    );
  }

  const missingApprovedAdSides = ['left', 'right'].filter((side) => !data.ads.some((ad) => (
    normalizedAdSide(ad) === side && adminAdStatus(ad)[0] === 'Live'
  )));
  const stats = data.stats;
  const approvalPanelSections = {
    'chamber-approvals': 'chamberApprovals',
    'job-approvals': 'jobApprovals',
    'business-approvals': 'businessApprovals',
  };
  const activeApprovalPanel = approvalPanelSections[panel];
  const activeApprovalKind = panel === 'chamber-approvals' ? 'memberships' : panel === 'job-approvals' ? 'jobs' : 'businesses';
  const approvalCounts = {
    pending: {
      memberships: stats?.chamberMemberships?.pending ?? data.members.filter((item) => item.status === 'pending').length,
      jobs: stats?.jobs?.pending ?? data.jobs.filter((item) => item.status === 'pending').length,
      businesses: stats?.businesses?.pending ?? data.businesses.filter((item) => item.status === 'pending').length,
    },
    approved: {
      memberships: stats?.chamberMemberships?.active ?? data.members.filter((item) => item.status === 'active').length,
      jobs: stats?.jobs?.published ?? data.jobs.filter((item) => item.status === 'published').length,
      businesses: stats?.businesses?.approved ?? data.businesses.filter((item) => item.status === 'approved').length,
    },
    rejected: {
      memberships: stats?.chamberMemberships?.rejected ?? data.members.filter((item) => item.status === 'rejected').length,
      jobs: stats?.jobs?.rejected ?? data.jobs.filter((item) => item.status === 'rejected').length,
      businesses: stats?.businesses?.rejected ?? data.businesses.filter((item) => item.status === 'rejected').length,
    },
  };
  const approvalTotals = Object.fromEntries(Object.entries(approvalCounts).map(([status, counts]) => [
    status,
    counts[activeApprovalKind] || 0,
  ]));
  const approvalRecords = {
    memberships: data.members.filter((item) => item.status === ({ pending: 'pending', approved: 'active', rejected: 'rejected' }[approvalStatus])),
    jobs: data.jobs.filter((item) => item.status === ({ pending: 'pending', approved: 'published', rejected: 'rejected' }[approvalStatus])),
    businesses: data.businesses.filter((item) => item.status === ({ pending: 'pending', approved: 'approved', rejected: 'rejected' }[approvalStatus])),
  };
  const statCards = stats ? user?.role === 'super_admin' ? [
    ['Total Users', stats.users.total],
    ['Active Users', stats.users.active],
    ['Pending Approvals', stats.chamberMemberships.pending + stats.businesses.pending + stats.jobs.pending],
    ['Total Chamber Members', stats.chamberMemberships.total],
    ['Pending Memberships', stats.chamberMemberships.pending],
    ['Total Businesses', stats.businesses.total],
    ['Pending Businesses', stats.businesses.pending],
    ['Total Jobs', stats.jobs.total],
    ['Pending Jobs', stats.jobs.pending],
    ['Total Job Applications', stats.applications.total],
    ['Total Admins', data.adminWork?.totalAdmins],
    ['Active Admins', data.adminWork?.activeAdmins],
  ] : [
    ...(stats.users ? [['Users', stats.users.total], ['Pending users', stats.users.pending]] : []),
    ...(stats.businesses ? [['Approved businesses', stats.businesses.approved], ['Pending listings', stats.businesses.pending]] : []),
    ...(stats.jobs ? [['Jobs', stats.jobs.total], ['Pending jobs', stats.jobs.pending]] : []),
    ...(stats.applications ? [['Applications', stats.applications.total]] : []),
    ...(stats.chamberMemberships ? [['Active members', stats.chamberMemberships.active], ['Pending memberships', stats.chamberMemberships.pending]] : []),
  ] : [];

  return (
    <section className="section">
      <div className="container admin-react">
        <header className="admin-react-heading">
          <div>
            <h1>{user?.role === 'super_admin' ? 'Super Admin Dashboard' : `Welcome, ${user?.name || 'Admin'}`}</h1>
            <p className="text-soft">{user?.role === 'super_admin' ? 'Manage administrator access and monitor assigned work.' : 'My assigned work'}</p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={loadData} disabled={loading}>↻ Refresh</button>
        </header>

        <nav className="admin-react-nav" aria-label="Admin dashboard sections">
          {visiblePanels.map(([key, label]) => (
            <button key={key} type="button" className={`dash-tab${panel === key ? ' active' : ''}`} onClick={() => setPanel(key)} aria-current={panel === key ? 'page' : undefined}>
              {label}
            </button>
          ))}
        </nav>

        {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
        {loading ? <div className="spinner-wrap"><div className="spinner" aria-label="Loading admin dashboard" /></div> : (
          <>
            {!visiblePanels.length && <div className="alert alert-info">No admin work has been assigned to your account.</div>}
            {panel === 'admin-management' && (
              <section className="admin-section">
                <h2>Admin management</h2>
                <form className="form-card admin-editor" onSubmit={createAdmin}>
                  <h3>Add Admin</h3>
                  <div className="admin-field-row">
                    <label>Admin name<input required value={adminDraft.name} onChange={(event) => setAdminDraft({ ...adminDraft, name: event.target.value })} /></label>
                    <label>Email<input required type="email" value={adminDraft.email} onChange={(event) => setAdminDraft({ ...adminDraft, email: event.target.value })} /></label>
                    <label>Phone<input required value={adminDraft.phone} onChange={(event) => setAdminDraft({ ...adminDraft, phone: event.target.value })} /></label>
                    <label>Temporary password<div className="password-control"><input required type={showAdminPassword ? 'text' : 'password'} minLength="8" value={adminDraft.password} onChange={(event) => setAdminDraft({ ...adminDraft, password: event.target.value })} /><PasswordVisibilityToggle visible={showAdminPassword} onToggle={() => setShowAdminPassword((visible) => !visible)} /></div></label>
                    <label>Confirm password<div className="password-control"><input required type={showConfirmAdminPassword ? 'text' : 'password'} minLength="8" value={adminDraft.confirmPassword} onChange={(event) => setAdminDraft({ ...adminDraft, confirmPassword: event.target.value })} /><PasswordVisibilityToggle visible={showConfirmAdminPassword} onToggle={() => setShowConfirmAdminPassword((visible) => !visible)} /></div></label>
                    <label>Status<select value={adminDraft.status} onChange={(event) => setAdminDraft({ ...adminDraft, status: event.target.value })}><option value="active">Active</option><option value="suspended">Inactive</option></select></label>
                  </div>
                  <h3>Assigned sections</h3>
                  <div className="admin-permission-list">
                    {ADMIN_PERMISSION_OPTIONS.map(([permissionKey, label]) => (
                      <label key={permissionKey} className="admin-checkbox admin-permission-toggle">
                        <input type="checkbox" checked={adminDraft.permissions[permissionKey]} onChange={(event) => setAdminDraft({ ...adminDraft, permissions: { ...adminDraft.permissions, [permissionKey]: event.target.checked } })} />
                        {label}
                      </label>
                    ))}
                  </div>
                  {adminCreateError && <div className="alert alert-danger" role="alert">{adminCreateError}</div>}
                  <button className="btn btn-primary" type="submit">Create Admin</button>
                </form>

                {viewingAdmin && (
                  <section className="admin-section">
                    <h3>Admin profile</h3>
                    <p><strong>{viewingAdmin.name}</strong> · {viewingAdmin.email} · {viewingAdmin.phone}</p>
                    <p>Status: {viewingAdmin.status} · Created: {new Date(viewingAdmin.createdAt).toLocaleString()}</p>
                    <p>Last login: {viewingAdmin.lastLogin ? new Date(viewingAdmin.lastLogin).toLocaleString() : 'Never'} · Last logout: {viewingAdmin.lastLogout ? new Date(viewingAdmin.lastLogout).toLocaleString() : 'Not recorded'}</p>
                    <p>Last activity: {viewingAdmin.lastActivity ? new Date(viewingAdmin.lastActivity).toLocaleString() : 'None recorded'}</p>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewingAdmin(null)}>Close profile</button>
                  </section>
                )}

                <Table headings={['Admin', 'Email', 'Status', 'Assigned Sections', 'Created', 'Last Login', 'Last Logout', 'Last Activity', 'Actions']}>
                  {data.admins.map((admin) => (
                    <tr key={admin._id}>
                      <td><strong>{admin.name}</strong><small>{admin.phone}</small></td>
                      <td>{admin.email}</td>
                      <td><span className={`status ${admin.status === 'active' ? 'active' : 'pending'}`}>{admin.status}</span></td>
                      <td>
                        <div className="admin-permission-list" id={`admin-permissions-${admin._id}`}>
                          {ADMIN_PERMISSION_OPTIONS.map(([permissionKey, label]) => (
                            <label key={permissionKey} className="admin-checkbox admin-permission-toggle">
                              <input
                                type="checkbox"
                                checked={permissionKey === 'dashboard' || admin.permissions?.[permissionKey] === true}
                                disabled={permissionKey === 'dashboard'}
                                onChange={(event) => updateAdminPermissions(admin._id, permissionKey, event.target.checked)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '—'}</td>
                      <td>{admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</td>
                      <td>{admin.lastLogout ? new Date(admin.lastLogout).toLocaleString() : '—'}</td>
                      <td>{admin.lastActivity ? new Date(admin.lastActivity).toLocaleString() : '—'}</td>
                      <td className="admin-actions">
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => setViewingAdmin(admin)}>View</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => editAdmin(admin)}>Edit details</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => document.getElementById(`admin-permissions-${admin._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Permissions</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => { setSelectedAdminId(admin._id); setPanel('admin-activity'); }}>Activity</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => runAction(() => adminApi.updateAdminStatus(admin._id, admin.status === 'active' ? 'suspended' : 'active'), `Admin ${admin.status === 'active' ? 'deactivated' : 'activated'}.`)}>{admin.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => { const password = window.prompt('Enter a temporary password (minimum 8 characters):'); if (password) runAction(() => adminApi.resetAdminPassword(admin._id, password), 'Admin password reset.'); }}>Reset password</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => { if (window.confirm(`Remove admin ${admin.name}?`)) runAction(() => adminApi.removeAdmin(admin._id), 'Admin removed.'); }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {!data.admins.length && <EmptyRow columns={9}>No admin accounts found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'admin-work' && (
              <section className="admin-section">
                <h2>Admin work overview</h2>
                <div className="admin-stat-grid">
                  {[
                    ['Total admins', data.adminWork?.totalAdmins],
                    ['Active admins', data.adminWork?.activeAdmins],
                    ['Inactive admins', data.adminWork?.inactiveAdmins],
                    ["Today's activities", data.adminWork?.activitiesToday],
                  ].map(([label, value]) => <div className="admin-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}
                </div>
                <Table headings={['Admin', 'Assigned work', 'Pending', 'Completed today', 'Last login', 'Last logout', 'Last activity', 'Activity status', 'Details']}>
                  {(data.adminWork?.admins || []).map((admin) => (
                    <tr key={admin._id}>
                      <td><strong>{admin.name}</strong><small>{admin.status}</small></td>
                      <td>{admin.assignedSections.map((section) => ADMIN_PERMISSION_OPTIONS.find(([key]) => key === section)?.[1] || section).join(', ') || 'None'}</td>
                      <td>{admin.pending}</td>
                      <td>{admin.completedToday}</td>
                      <td>{admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</td>
                      <td>{admin.lastLogout ? new Date(admin.lastLogout).toLocaleString() : '—'}</td>
                      <td>{admin.lastActivity ? new Date(admin.lastActivity.timestamp).toLocaleString() : 'No activity recorded'}</td>
                      <td>{admin.activityStatus}</td>
                      <td><button className="btn btn-outline btn-sm" type="button" onClick={() => { setSelectedAdminId(admin._id); setPanel('admin-activity'); }}>View activity</button></td>
                    </tr>
                  ))}
                  {!data.adminWork?.admins?.length && <EmptyRow columns={9}>No normal admin accounts found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'admin-activity' && (
              <section className="admin-section">
                <h2>Admin activity</h2>
                <div className="admin-field-row">
                  <label>Admin<select value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}><option value="">All admins</option>{(data.adminWork?.admins || []).map((admin) => <option key={admin._id} value={admin._id}>{admin.name}</option>)}</select></label>
                  <label>Section<select value={activityFilters.section} onChange={(event) => setActivityFilters({ ...activityFilters, section: event.target.value })}><option value="">All sections</option>{['Authentication', 'Admin Management', 'Chamber Membership', 'Chamber Membership Approval', 'Chamber Member Documents', 'QR Codes', 'Jobs', 'Job Approvals', 'Job Applications', 'Business Listings', 'Business Approvals', 'News', 'Advertisements', 'Offers', 'Users', 'Reports', 'System Settings'].map((section) => <option key={section}>{section}</option>)}</select></label>
                  <label>Action<select value={activityFilters.action} onChange={(event) => setActivityFilters({ ...activityFilters, action: event.target.value })}><option value="">All actions</option>{['LOGIN', 'LOGOUT', 'Viewed Users', 'Viewed Admin Management', 'Viewed Chamber Membership', 'Viewed Chamber Membership Approval', 'Viewed Chamber Member Documents', 'Viewed QR Codes', 'Viewed Jobs', 'Viewed Job Approvals', 'Viewed Job Applications', 'Viewed Business Listings', 'Viewed Business Approvals', 'Viewed News', 'Viewed Advertisements', 'Viewed Offers', 'Viewed Reports', 'Viewed System Settings', 'Approved Membership', 'Rejected Membership', 'Approved Job', 'Rejected Job', 'Approved Business', 'Rejected Business', 'Created News', 'Updated News', 'Created Advertisement', 'Updated Advertisement', 'Updated Record', 'Updated Admin', 'Updated Admin Permissions', 'Created Admin', 'Deactivated Admin', 'Activated Admin', 'Removed Admin', 'Reset Admin Password'].map((action) => <option key={action}>{action}</option>)}</select></label>
                  <label>Status<select value={activityFilters.status} onChange={(event) => setActivityFilters({ ...activityFilters, status: event.target.value })}><option value="">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option></select></label>
                  <label>Date<input type="date" value={activityFilters.date} onChange={(event) => setActivityFilters({ ...activityFilters, date: event.target.value })} /></label>
                </div>
                <Table headings={['Admin', 'Section', 'Action', 'Target', 'Description', 'Date and time', 'Status']}>
                  {data.adminActivity.map((activity) => (
                    <tr key={activity._id}>
                      <td>{activity.adminName}</td><td>{activity.section}</td><td>{activity.action}</td>
                      <td>{activity.targetType}{activity.targetId ? ` · ${activity.targetId}` : ''}</td>
                      <td>{activity.description}</td><td>{new Date(activity.timestamp).toLocaleString()}</td><td>{activity.status}</td>
                    </tr>
                  ))}
                  {!data.adminActivity.length && <EmptyRow columns={7}>No activity has been recorded.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'reports' && (
              <section className="admin-section">
                <h2>Reports</h2>
                <div className="admin-stat-grid">
                  {Object.entries(data.reports || {}).map(([key, value]) => <div className="admin-stat" key={key}><strong>{value}</strong><span>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span></div>)}
                </div>
              </section>
            )}

            {panel === 'system-settings' && (
              <section className="admin-section">
                <h2>System Settings</h2>
                <div className="admin-stat-grid">
                  {[
                    ['Database', data.systemSettings?.database || 'Unknown'],
                    ['Runtime', data.systemSettings?.nodeVersion || 'Unknown'],
                    ['Environment', data.systemSettings?.environment || 'Unknown'],
                    ['Uptime', data.systemSettings ? `${Math.floor(data.systemSettings.uptimeSeconds / 3600)}h ${Math.floor((data.systemSettings.uptimeSeconds % 3600) / 60)}m` : 'Unknown'],
                  ].map(([label, value]) => <div className="admin-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
                </div>
              </section>
            )}

            {panel === 'overview' && (
              <div>
                <div className="admin-stat-grid">
                  {statCards.map(([label, value]) => <div className="admin-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}
                  {user?.role === 'super_admin' && data.adminWork && <div className="admin-stats">
                    {/* <strong>{data.adminWork.activitiesToday}</strong><span>Today's admin activities</span> */}
                    </div>}
                </div>
                <section className="admin-section">
                  <h2>Pending actions</h2>
                  <div className="admin-pending-grid">
                    {[
                      ['chamber-approvals', stats?.chamberMemberships?.pending, 'Membership approvals', 'chamberApprovals'],
                      ['job-approvals', stats?.jobs?.pending, 'Job approvals', 'jobApprovals'],
                      ['business-approvals', stats?.businesses?.pending, 'Business approvals', 'businessApprovals'],
                      ['users', stats?.users?.pending, 'User accounts', 'users'],
                      ['members', stats?.chamberMemberships?.pending, 'Chamber membership', 'chamberMembership'],
                      ['jobs', stats?.jobs?.pending, 'Job postings', 'jobs'],
                    ].filter(([, , , permission]) => canAccessAdminSection(permission)).map(([key, count, label]) => (
                      <button type="button" className="admin-pending-item" key={key} onClick={() => setPanel(key)}>
                        <strong>{count ?? 0}</strong><span>{label}</span><span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </section>
                {user?.role === 'admin' && (
                  <section className="admin-section">
                    <h2>My completed work today: {data.myCompletedToday}</h2>
                    <Table headings={['Section', 'Action', 'Description', 'Date and time', 'Status']}>
                      {data.myActivity.map((activity) => <tr key={activity._id}><td>{activity.section}</td><td>{activity.action}</td><td>{activity.description}</td><td>{new Date(activity.timestamp).toLocaleString()}</td><td>{activity.status}</td></tr>)}
                      {!data.myActivity.length && <EmptyRow columns={5}>No activity recorded for your assigned sections.</EmptyRow>}
                    </Table>
                  </section>
                )}
              </div>
            )}

            {activeApprovalPanel && (
              <div className="admin-approvals">
                <div className="approval-status-grid" role="tablist" aria-label="Approval status">
                  {[
                    ['pending', `Pending (${activeApprovalKind})`],
                    ['approved', 'Approved'],
                    ['rejected', 'Rejected'],
                  ].map(([status, label]) => (
                    <button key={status} type="button" role="tab" aria-selected={approvalStatus === status}
                      className={`approval-status-card${approvalStatus === status ? ' active' : ''}`}
                      onClick={() => setApprovalStatus(status)}>
                      <strong>{approvalTotals[status]}</strong><span>{label}</span>
                    </button>
                  ))}
                </div>

                {panel === 'chamber-approvals' && <section className="admin-section approval-resource-section">
                  <h2>Chamber Memberships <span className="approval-count">{approvalCounts[approvalStatus].memberships}</span></h2>
                  <Table headings={['Business / Applicant', 'Plan', 'Submitted', 'Status / Rejection reason', 'Review']}>
                    {approvalRecords.memberships.map((member) => (
                      <tr key={member._id}>
                        <td><strong>{member.businessName}</strong><small>{member.ownerName} · {member.phone || member.email || 'No contact details'}</small></td>
                        <td>{member.plan || '—'}</td>
                        <td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}</td>
                        <td><span className={`status ${member.status === 'active' ? 'active' : member.status === 'rejected' ? 'declined' : 'pending'}`}>{member.status}</span>{member.rejectionReason && <small>{member.rejectionReason}</small>}</td>
                        <td className="approval-review-actions">
                          {approvalStatus === 'pending' && <>
                            <button className="btn btn-primary btn-sm" type="button" onClick={() => updateApprovalStatus('membership', member, 'approved')}>Approve</button>
                            <input aria-label={`Reason for rejecting ${member.businessName}`} value={approvalReasons[`membership:${member._id}`] || ''} onChange={(event) => setApprovalReasons({ ...approvalReasons, [`membership:${member._id}`]: event.target.value })} placeholder="Rejection reason" />
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => updateApprovalStatus('membership', member, 'rejected')}>Reject</button>
                          </>}
                          {approvalStatus === 'approved' && <span>Member active · QR provisioned</span>}
                        </td>
                      </tr>
                    ))}
                    {!approvalRecords.memberships.length && <EmptyRow columns={5}>No {approvalStatus} Chamber memberships.</EmptyRow>}
                  </Table>
                </section>}

                {panel === 'job-approvals' && <section className="admin-section approval-resource-section">
                  <h2>Job Posts <span className="approval-count">{approvalCounts[approvalStatus].jobs}</span></h2>
                  <Table headings={['Job / Employer', 'Details', 'Submitted', 'Status / Rejection reason', 'Review']}>
                    {approvalRecords.jobs.map((job) => (
                      <tr key={job._id}>
                        <td><strong>{job.title}</strong><small>{job.business?.name || job.company || 'Company not provided'}</small></td>
                        <td>{[job.location, job.employmentType, job.salary].filter(Boolean).join(' · ') || '—'}<small>{job.description}</small>{job.requirements && <small>Requirements: {job.requirements}</small>}{job.closingDate && <small>Closes: {new Date(job.closingDate).toLocaleDateString()}</small>}</td>
                        <td>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '—'}</td>
                        <td><span className={`status ${job.status === 'published' ? 'active' : job.status === 'rejected' ? 'declined' : 'pending'}`}>{job.status}</span>{job.rejectionReason && <small>{job.rejectionReason}</small>}</td>
                        <td className="approval-review-actions">
                          {approvalStatus === 'pending' && <>
                            <button className="btn btn-primary btn-sm" type="button" onClick={() => updateApprovalStatus('job', job, 'approved')}>Approve</button>
                            <input aria-label={`Reason for rejecting ${job.title}`} value={approvalReasons[`job:${job._id}`] || ''} onChange={(event) => setApprovalReasons({ ...approvalReasons, [`job:${job._id}`]: event.target.value })} placeholder="Rejection reason" />
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => updateApprovalStatus('job', job, 'rejected')}>Reject</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                    {!approvalRecords.jobs.length && <EmptyRow columns={5}>No {approvalStatus} job posts.</EmptyRow>}
                  </Table>
                </section>}

                {panel === 'business-approvals' && <section className="admin-section approval-resource-section">
                  <h2>Business Listings <span className="approval-count">{approvalCounts[approvalStatus].businesses}</span></h2>
                  <Table headings={['Business / Applicant', 'Category', 'Submitted', 'Status / Rejection reason', 'Review']}>
                    {approvalRecords.businesses.map((business) => (
                      <tr key={business._id}>
                        <td>
                          <strong>{business.businessName || business.name}</strong>
                          <small>Owner: {business.ownerName || '—'}</small>
                          <small>Owner phone (Private / Admin Only): {business.ownerPhone || 'Not provided'}</small>
                          <small>Business phone: {business.phone || '—'} · {business.address || 'Address not provided'}</small>
                          {business.description && <small>{business.description}</small>}
                          {[business.email, business.website].filter(Boolean).map((detail) => <small key={`${business._id}-${detail}`}>{detail}</small>)}
                          <div className="approval-business-images">
                            {[business.logo, ...(business.images || [])].filter(Boolean).slice(0, 4).map((image, index) => <a href={image} target="_blank" rel="noreferrer" key={`${business._id}-image-${index}`}><img src={image} alt={`${business.businessName || business.name} listing ${index + 1}`} /></a>)}
                          </div>
                        </td>
                        <td>{business.category || '—'}</td>
                        <td>{business.createdAt ? new Date(business.createdAt).toLocaleDateString() : '—'}</td>
                        <td><span className={`status ${business.status === 'approved' ? 'active' : business.status === 'rejected' ? 'declined' : 'pending'}`}>{business.status}</span>{business.rejectionReason && <small>{business.rejectionReason}</small>}</td>
                        <td className="approval-review-actions">
                          {approvalStatus === 'pending' && <>
                            <button className="btn btn-primary btn-sm" type="button" onClick={() => updateApprovalStatus('business', business, 'approved')}>Approve</button>
                            <input aria-label={`Reason for rejecting ${business.businessName || business.name}`} value={approvalReasons[`business:${business._id}`] || ''} onChange={(event) => setApprovalReasons({ ...approvalReasons, [`business:${business._id}`]: event.target.value })} placeholder="Rejection reason" />
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => updateApprovalStatus('business', business, 'rejected')}>Reject</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                    {!approvalRecords.businesses.length && <EmptyRow columns={5}>No {approvalStatus} business listings.</EmptyRow>}
                  </Table>
                </section>}
              </div>
            )}

            {panel === 'users' && (
              <section className="admin-section"><h2>User accounts</h2>
                <Table headings={['Name', 'Email', 'Phone', 'Role', 'Status', 'Action']}>
                  {data.users.map((user) => <tr key={user._id}>
                    <td>{user.name}</td><td>{user.email}</td><td>{user.phone || '—'}</td><td>{user.role}</td><td><span className={`status ${user.status === 'active' ? 'active' : 'pending'}`}>{user.status}</span></td>
                    <td>{user.role !== 'admin' && user.status !== 'active' ? <button className="btn btn-primary btn-sm" type="button" onClick={() => runAction(() => adminApi.updateUserStatus(user._id, 'active'), 'User activated.')}>Activate</button> : user.role !== 'admin' ? <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.updateUserStatus(user._id, 'suspended'), 'User suspended.')}>Suspend</button> : '—'}</td>
                  </tr>)}
                  {!data.users.length && <EmptyRow columns={6}>No user accounts found.</EmptyRow>}
                </Table>
              </section>
            )}

            {(panel === 'listings' || panel === 'directory') && (
              <section className="admin-section"><h2>{panel === 'listings' ? 'Free listing submissions' : 'Directory listings'}</h2>
                <Table headings={['Business', 'Category', 'Phone', 'Status', 'Action']}>
                  {data.businesses.map((business) => <tr key={business._id}>
                    <td><strong>{business.businessName || business.name}</strong><small>Owner: {business.ownerName || '—'}</small><small>Owner phone (Private / Admin Only): {business.ownerPhone || 'Not provided'}</small><small>{business.address || 'Address not provided'}</small></td>
                    <td>{business.category || '—'}</td><td>{business.phone || '—'}</td><td><span className={`status ${business.status === 'approved' ? 'active' : business.status === 'rejected' ? 'declined' : 'pending'}`}>{business.status}</span></td>
                    <td className="admin-actions">{canAccessAdminSection('businessApprovals') && <>{business.status !== 'approved' && <button className="btn btn-primary btn-sm" type="button" onClick={() => runAction(() => adminApi.updateBizStatus(business._id, 'approved'), 'Business approved.')}>Approve</button>}{business.status === 'approved' && <button className="btn btn-outline btn-sm" type="button" onClick={() => runAction(() => adminApi.updateBizStatus(business._id, 'suspended'), 'Business suspended.')}>Suspend</button>}{business.status === 'pending' && <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.updateBizStatus(business._id, 'rejected'), 'Business rejected.')}>Reject</button>}</>}</td>
                  </tr>)}
                  {!data.businesses.length && <EmptyRow columns={5}>No business listings found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'members' && (
              <section className="admin-section"><h2>Chamber membership applications</h2>
                <Table headings={['Business', 'Owner', 'Plan', 'Applied', 'Expiry', 'Status', 'Action']}>
                  {data.members.map((member) => <tr key={member._id}>
                    <td>{member.businessName}</td><td>{member.ownerName}<small>{member.phone || member.email}</small></td><td>{member.plan || '—'}</td><td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}</td><td>{member.membershipExpiryDate ? new Date(member.membershipExpiryDate).toLocaleDateString() : '—'}</td><td><span className={`status ${member.status === 'active' ? 'active' : member.status === 'rejected' ? 'declined' : 'pending'}`}>{member.status}</span></td>
                    <td className="admin-actions">{member.status === 'pending' && canAccessAdminSection('chamberApprovals') && <><button className="btn btn-primary btn-sm" type="button" onClick={() => runAction(() => adminApi.approveMember(member._id), 'Membership approved.')}>Approve</button><button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.rejectMember(member._id), 'Membership rejected.')}>Reject</button></>}{member.status === 'active' && canAccessAdminSection('chamberMembership') && <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => apiRequest(`/admin/chamber-members/${member._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'suspended' }) }), 'Membership suspended.')}>Suspend</button>}</td>
                  </tr>)}
                  {!data.members.length && <EmptyRow columns={7}>No membership applications found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'qr-directory' && (
              <section className="admin-section"><h2>Chamber QR Directory</h2>
                <Table headings={['Member', 'Membership #', 'QR', 'Status', 'Actions']}>
                  {data.memberQrCodes.map((entry) => {
                    const membership = entry.membership || {};
                    const publicId = entry.publicId || entry.qrValue || '';
                    const publicProfileUrl = publicId ? `/chamber-member-profile?publicId=${encodeURIComponent(publicId)}` : '#';
                    return (
                      <tr key={entry.membershipId || entry._id || membership._id}>
                        <td><strong>{membership.businessName || 'Member'}</strong><small>{membership.ownerName || '—'} · {membership.category || '—'}</small></td>
                        <td>{membership.membershipNumber || entry.membershipNumber || '—'}</td>
                        <td>{entry.imageDataUrl ? <img src={entry.imageDataUrl} alt={`${membership.businessName || 'Member'} QR code`} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 8 }} /> : <span className="text-soft">No active QR</span>}</td>
                        <td><span className={`status ${entry.status === 'active' ? 'active' : entry.status === 'disabled' ? 'declined' : 'pending'}`}>{entry.status}</span></td>
                        <td className="admin-actions">
                          {publicId && <a className="btn btn-outline btn-sm" href={publicProfileUrl} target="_blank" rel="noreferrer">View profile</a>}
                          {entry.imageDataUrl && <a className="btn btn-outline btn-sm" href={entry.imageDataUrl} download={`${membership.membershipNumber || 'chamber-member'}-qr.png`}>Download</a>}
                          {entry._id && <button type="button" className="btn btn-outline btn-sm" onClick={() => runAction(() => adminApi.updateQrCodeStatus(entry._id, entry.status === 'active' ? 'disabled' : 'active'), entry.status === 'active' ? 'QR disabled.' : 'QR activated.')}>{entry.status === 'active' ? 'Deactivate' : 'Activate'}</button>}
                          {membership._id && <button type="button" className="btn btn-danger btn-sm" onClick={() => runAction(() => adminApi.regenerateMemberQr(membership._id), 'QR regenerated.')}>Regenerate</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {!data.memberQrCodes.length && <EmptyRow columns={5}>No active Chamber member QR records found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'jobs' && (
              <section className="admin-section"><h2>Job postings</h2>
                <Table headings={['Title', 'Company', 'Type', 'Applicants', 'Status', 'Action']}>
                  {data.jobs.map((job) => <tr key={job._id}>
                    <td>{job.title}</td><td>{job.business?.name || job.company || '—'}</td><td>{job.employmentType || '—'}</td><td>{job.applicationCount ?? '—'}</td><td><span className={`status ${job.status === 'published' ? 'active' : job.status === 'rejected' ? 'declined' : 'pending'}`}>{job.status}</span></td>
                    <td className="admin-actions">{job.status === 'pending' && canAccessAdminSection('jobApprovals') && <><button className="btn btn-primary btn-sm" type="button" onClick={() => runAction(() => adminApi.updateJobStatus(job._id, 'published'), 'Job published.')}>Approve</button><button className="btn btn-danger btn-sm" type="button" onClick={() => { const reason = window.prompt('Reason for rejecting this job:'); if (reason?.trim()) runAction(() => adminApi.updateJobStatus(job._id, 'rejected', reason.trim()), 'Job rejected.'); }}>Reject</button></>}{job.status === 'published' && canAccessAdminSection('jobs') && <button className="btn btn-outline btn-sm" type="button" onClick={() => runAction(() => adminApi.updateJobStatus(job._id, 'closed'), 'Job closed.')}>Close</button>}</td>
                  </tr>)}
                  {!data.jobs.length && <EmptyRow columns={6}>No jobs found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'applications' && (
              <section className="admin-section"><h2>Job applications</h2>
                <Table headings={['Candidate', 'Job', 'Company', 'Education', 'Experience', 'Applied', 'Status', 'Action']}>
                  {data.applications.map((application) => <tr key={application._id}>
                    <td>{application.jobSeeker?.name || 'Candidate'}<small>{application.jobSeeker?.email}</small></td><td>{application.job?.title || '—'}</td><td>{application.job?.company || '—'}</td><td>{application.education || '—'}</td><td>{application.experience || '—'}</td><td>{application.createdAt ? new Date(application.createdAt).toLocaleDateString() : '—'}</td><td>{application.status}</td>
                    <td className="admin-actions"><button className="btn btn-outline btn-sm" type="button" onClick={() => openCv(`/admin/applications/${application._id}/cv`)}>View CV</button><select aria-label={`Update ${application.jobSeeker?.name || 'candidate'} application status`} value={application.status} onChange={(event) => runAction(() => adminApi.updateAppStatus(application._id, event.target.value), 'Application status updated.')}><option value="submitted">Submitted</option><option value="eligible">Eligible</option><option value="shortlisted">Shortlisted</option><option value="not_eligible">Not eligible</option><option value="rejected">Rejected</option></select></td>
                  </tr>)}
                  {!data.applications.length && <EmptyRow columns={8}>No applications found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'resumes' && (
              <section className="admin-section"><h2>Uploaded candidate CVs</h2>
                <Table headings={['Candidate', 'Location', 'Education', 'Experience', 'Skills', 'CV']}>
                  {data.resumes.map((resume) => <tr key={resume.id}><td>{resume.name}<small>{resume.email} · {resume.phone}</small></td><td>{resume.location || '—'}</td><td>{resume.education || '—'}</td><td>{resume.experience || '—'}</td><td>{(resume.skills || []).join(', ') || '—'}</td><td><button type="button" className="btn btn-outline btn-sm" onClick={() => openCv(`/resumes/${resume.id}/cv`)}>{resume.cv?.fileName || 'View CV'}</button></td></tr>)}
                  {!data.resumes.length && <EmptyRow columns={6}>No uploaded CVs found.</EmptyRow>}
                </Table>
              </section>
            )}

            {panel === 'news' && (
              <div className="admin-content-grid">
                <form className="form-card admin-editor" onSubmit={(event) => saveNews(event)}>
                  <h2>{editingNews ? 'Edit news' : 'Create news'}</h2>
                  <label>Title<input required value={newsDraft.title} onChange={(event) => setNewsDraft({ ...newsDraft, title: event.target.value })} /></label>
                  <label>Category<input value={newsDraft.category} onChange={(event) => setNewsDraft({ ...newsDraft, category: event.target.value })} /></label>
                  <label>Description<textarea value={newsDraft.description} onChange={(event) => setNewsDraft({ ...newsDraft, description: event.target.value })} /></label>
                  <label>Image URL<input type="url" value={newsDraft.image} onChange={(event) => setNewsDraft({ ...newsDraft, image: event.target.value })} /></label>
                  <label>Content<textarea required rows="5" value={newsDraft.content} onChange={(event) => setNewsDraft({ ...newsDraft, content: event.target.value })} /></label>
                  <label>Status<select value={newsDraft.status} onChange={(event) => setNewsDraft({ ...newsDraft, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                  <div className="admin-actions"><button className="btn btn-primary" type="submit">Save news</button><button className="btn btn-accent" type="button" onClick={(event) => saveNews(event, true)}>Save and publish</button></div>
                </form>
                <section className="admin-section"><h2>News items</h2><Table headings={['Title', 'Category', 'Status', 'Actions']}>
                  {data.news.map((item) => <tr key={item._id}><td>{item.title}</td><td>{item.category || '—'}</td><td>{item.status}</td><td className="admin-actions"><button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditingNews(item._id); setNewsDraft({ title: item.title || '', category: item.category || '', description: item.description || item.summary || '', image: item.image || '', content: item.content || '', status: item.status || 'draft' }); }}>Edit</button><button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.deleteNews(item._id), 'News deleted.')}>Delete</button></td></tr>)}
                  {!data.news.length && <EmptyRow columns={4}>No news items found.</EmptyRow>}
                </Table></section>
              </div>
            )}

            {panel === 'community-updates' && (
              <div className="admin-content-grid">
                <form className="form-card admin-editor" onSubmit={saveCommunityUpdate}>
                  <h2>{editingCommunityUpdate ? 'Edit community update' : 'Add community update'}</h2>
                  <label>Category<select value={communityUpdateDraft.category} onChange={(event) => { const category = event.target.value; setCommunityUpdateDraft({ ...communityUpdateDraft, category, icon: category === 'custom' ? communityUpdateDraft.icon : COMMUNITY_UPDATE_ICONS[category] }); }}>
                    {COMMUNITY_UPDATE_CATEGORIES.map(([category, label]) => <option key={category} value={category}>{label}</option>)}
                    <option value="custom">Custom category</option>
                  </select></label>
                  {communityUpdateDraft.category === 'custom' && <label>Custom category key<input required maxLength={64} value={communityUpdateDraft.customCategory} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, customCategory: event.target.value })} placeholder="Example: workshops" /></label>}
                  <label>Update text<textarea required maxLength={500} rows="3" value={communityUpdateDraft.text} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, text: event.target.value })} /></label>
                  <label>Emoji or icon<input required maxLength={16} value={communityUpdateDraft.icon} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, icon: event.target.value })} /></label>
                  <div className="admin-field-row">
                    <label>Show from (optional)<input type="datetime-local" value={communityUpdateDraft.startAt} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, startAt: event.target.value })} /></label>
                    <label>Show until (optional)<input type="datetime-local" value={communityUpdateDraft.endAt} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, endAt: event.target.value })} /></label>
                  </div>
                  <label>Status<select value={communityUpdateDraft.status} onChange={(event) => setCommunityUpdateDraft({ ...communityUpdateDraft, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                  <div className="admin-actions">
                    <button className="btn btn-primary" type="submit">{editingCommunityUpdate ? 'Save changes' : 'Add update'}</button>
                    {editingCommunityUpdate && <button className="btn btn-outline" type="button" onClick={() => { setEditingCommunityUpdate(''); setCommunityUpdateDraft(newCommunityUpdateDraft()); }}>Cancel</button>}
                  </div>
                </form>
                <section className="admin-section"><h2>Community updates</h2>
                  <Table headings={['Icon', 'Category', 'Update', 'Created', 'Valid dates', 'Status', 'Actions']}>
                    {data.communityUpdates.map((item) => <tr key={item._id}>
                      <td>{item.icon}</td>
                      <td>{item.category}</td>
                      <td>{item.text}</td>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
                      <td>{item.startAt ? new Date(item.startAt).toLocaleString() : 'Any time'} – {item.endAt ? new Date(item.endAt).toLocaleString() : 'No end'}</td>
                      <td><select aria-label={`Set community update status for ${item.text}`} value={item.status} onChange={(event) => runAction(() => adminApi.updateCommunityUpdateStatus(item._id, event.target.value), 'Community update status changed.')}><option value="active">Active</option><option value="inactive">Inactive</option></select></td>
                      <td className="admin-actions">
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => { const knownCategory = COMMUNITY_UPDATE_CATEGORIES.some(([category]) => category === item.category); setEditingCommunityUpdate(item._id); setCommunityUpdateDraft({ category: knownCategory ? item.category : 'custom', customCategory: knownCategory ? '' : item.category, text: item.text || '', icon: item.icon || '📌', status: item.status || 'active', startAt: item.startAt ? localDateTime(item.startAt) : '', endAt: item.endAt ? localDateTime(item.endAt) : '' }); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.deleteCommunityUpdate(item._id), 'Community update deleted.')}>Delete</button>
                      </td>
                    </tr>)}
                    {!data.communityUpdates.length && <EmptyRow columns={7}>No community updates found.</EmptyRow>}
                  </Table>
                </section>
              </div>
            )}

            {panel === 'offers' && (
              <div className="admin-content-grid">
                <form className="form-card admin-editor" onSubmit={(event) => saveOffer(event)}>
                  <h2>{editingOffer ? 'Edit offer' : 'Create offer'}</h2>
                  <label>Title<input required value={offerDraft.title} onChange={(event) => setOfferDraft({ ...offerDraft, title: event.target.value })} /></label>
                  <label>Category<select value={offerDraft.category} onChange={(event) => setOfferDraft({ ...offerDraft, category: event.target.value })}>{['education', 'electronics', 'food', 'coffee', 'offers', 'local'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label>Description<textarea value={offerDraft.description} onChange={(event) => setOfferDraft({ ...offerDraft, description: event.target.value })} /></label>
                  <label>Image URL<input type="url" value={offerDraft.image} onChange={(event) => setOfferDraft({ ...offerDraft, image: event.target.value })} /></label>
                  <label>Link<input type="url" value={offerDraft.link} onChange={(event) => setOfferDraft({ ...offerDraft, link: event.target.value })} /></label>
                  <div className="admin-field-row"><label>Start date<input required type="date" value={offerDraft.startDate.slice(0, 10)} onChange={(event) => setOfferDraft({ ...offerDraft, startDate: event.target.value })} /></label><label>End date<input required type="date" value={offerDraft.endDate.slice(0, 10)} onChange={(event) => setOfferDraft({ ...offerDraft, endDate: event.target.value })} /></label></div>
                  <label>Status<select value={offerDraft.status} onChange={(event) => setOfferDraft({ ...offerDraft, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="expired">Expired</option></select></label>
                  <div className="admin-actions"><button className="btn btn-primary" type="submit">Save offer</button><button className="btn btn-accent" type="button" onClick={(event) => saveOffer(event, true)}>Save and publish</button></div>
                </form>
                <section className="admin-section"><h2>Offers</h2><Table headings={['Title', 'Category', 'Dates', 'Status', 'Actions']}>
                  {data.offers.map((item) => <tr key={item._id}><td>{item.title}</td><td>{item.category || '—'}</td><td>{item.startDate ? new Date(item.startDate).toLocaleDateString() : '—'} – {item.endDate ? new Date(item.endDate).toLocaleDateString() : '—'}</td><td>{item.status}</td><td className="admin-actions"><button className="btn btn-outline btn-sm" type="button" onClick={() => { setEditingOffer(item._id); setOfferDraft({ title: item.title || '', category: item.category || 'offers', description: item.description || '', image: item.image || '', link: item.link || '', startDate: item.startDate || '', endDate: item.endDate || '', status: item.status || 'draft' }); }}>Edit</button><button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.deleteOffer(item._id), 'Offer deleted.')}>Delete</button></td></tr>)}
                  {!data.offers.length && <EmptyRow columns={5}>No offers found.</EmptyRow>}
                </Table></section>
              </div>
            )}

            {panel === 'hero-slider' && (
              <div className="admin-content-grid">
                <form className="form-card admin-editor" onSubmit={saveHeroSlide}>
                  <h2>{editingHeroSlide ? 'Edit hero slide' : 'Create hero slide'}</h2>
                  {/* <p className="text-soft">JPG, PNG or WebP · Maximum 2 MB. Recommended 1920 × 600 px (16:5), mobile 750 × 500 px (3:2), optional large-screen 2560 × 800 px. Aspect ratio differences are allowed with a warning.</p> */}
                  <ImageMethodField label="Desktop image" uploadValue={heroSlideDraft.desktopImage} urlValue={heroSlideDraft.image_url} method={heroSlideDraft.imageMethod} setMethod={(value) => setHeroSlideDraft((current) => ({ ...current, imageMethod: value }))} setUrlValue={(value) => setHeroSlideDraft((current) => ({ ...current, image_url: value, imageLinkReady: false }))} urlReady={heroSlideDraft.imageLinkReady} setUrlReady={(value) => setHeroSlideDraft((current) => ({ ...current, imageLinkReady: value }))} recommendedWidth={1920} recommendedHeight={600} onUpload={(event) => updateImageUpload(event, setHeroSlideDraft, 'desktopImage', 'imageMethod', 'image_source', 'imageLinkReady', 'Desktop image')} />
                  <ImageMethodField label="Large-screen image (optional)" uploadValue={heroSlideDraft.wideImage} urlValue={heroSlideDraft.wide_image_url} method={heroSlideDraft.wideImageMethod} setMethod={(value) => setHeroSlideDraft((current) => ({ ...current, wideImageMethod: value }))} setUrlValue={(value) => setHeroSlideDraft((current) => ({ ...current, wide_image_url: value, wideImageLinkReady: false }))} urlReady={heroSlideDraft.wideImageLinkReady} setUrlReady={(value) => setHeroSlideDraft((current) => ({ ...current, wideImageLinkReady: value }))} recommendedWidth={2560} recommendedHeight={800} onUpload={(event) => updateImageUpload(event, setHeroSlideDraft, 'wideImage', 'wideImageMethod', 'wide_image_source', 'wideImageLinkReady', 'Large-screen image')} />
                  <ImageMethodField label="Mobile image (optional)" uploadValue={heroSlideDraft.mobileImage} urlValue={heroSlideDraft.mobile_image_url} method={heroSlideDraft.mobileImageMethod} setMethod={(value) => setHeroSlideDraft((current) => ({ ...current, mobileImageMethod: value }))} setUrlValue={(value) => setHeroSlideDraft((current) => ({ ...current, mobile_image_url: value, mobileImageLinkReady: false }))} urlReady={heroSlideDraft.mobileImageLinkReady} setUrlReady={(value) => setHeroSlideDraft((current) => ({ ...current, mobileImageLinkReady: value }))} recommendedWidth={750} recommendedHeight={500} onUpload={(event) => updateImageUpload(event, setHeroSlideDraft, 'mobileImage', 'mobileImageMethod', 'mobile_image_source', 'mobileImageLinkReady', 'Mobile image')} />
                  <label className="admin-checkbox"><input type="checkbox" checked={heroSlideDraft.copy_linked_image} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, copy_linked_image: event.target.checked })} /> Copy linked image to my server</label>
                  <label>Image alt text<input required value={heroSlideDraft.altText} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, altText: event.target.value })} /></label>
                  <label className="admin-checkbox"><input type="checkbox" checked={heroSlideDraft.show_text === true} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, show_text: event.target.checked })} /> Show heading and description</label>
                  {heroSlideDraft.show_text === true && (
                    <>
                      <label>Title (optional) <span className="hero-slide-character-count">{heroSlideDraft.title.length}/80</span><input maxLength={80} value={heroSlideDraft.title} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, title: event.target.value })} /></label>
                      <label>Description (optional) <span className="hero-slide-character-count">{heroSlideDraft.description.length}/160</span><textarea maxLength={160} value={heroSlideDraft.description} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, description: event.target.value })} /></label>
                    </>
                  )}
                  <div className="hero-slide-live-preview">
                    {(heroSlideDraft.imageMethod === 'url' ? heroSlideDraft.image_url : heroSlideDraft.desktopImage) && <img src={heroSlideDraft.imageMethod === 'url' ? heroSlideDraft.image_url : heroSlideDraft.desktopImage} alt={heroSlideDraft.altText || 'Hero slide preview'} />}
                    {heroSlideDraft.show_text === true && (heroSlideDraft.title.trim() || heroSlideDraft.description.trim()) && <span className="hero-slide-live-preview-overlay" />}
                    {heroSlideDraft.show_text === true && (heroSlideDraft.title.trim() || heroSlideDraft.description.trim()) && (
                      <div className="hero-slide-live-preview-caption">
                        {heroSlideDraft.title.trim() && <strong>{heroSlideDraft.title.replace(/<[^>]*>/g, '').trim()}</strong>}
                        {heroSlideDraft.description.trim() && <span>{heroSlideDraft.description.replace(/<[^>]*>/g, '').trim()}</span>}
                      </div>
                    )}
                  </div>
                  <div className="admin-field-row"><label>Button text<input value={heroSlideDraft.buttonText} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, buttonText: event.target.value })} /></label><label>Button link<input value={heroSlideDraft.buttonLink} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, buttonLink: event.target.value })} /></label></div>
                  <div className="admin-field-row"><label>Display order<input type="number" min="0" value={heroSlideDraft.order} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, order: event.target.value })} /></label><label className="admin-checkbox"><input type="checkbox" checked={heroSlideDraft.active} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, active: event.target.checked })} /> Active</label></div>
                  <div className="admin-field-row"><label>Start date<input type="datetime-local" value={heroSlideDraft.startDate} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, startDate: event.target.value })} /></label><label>End date<input type="datetime-local" value={heroSlideDraft.endDate} onChange={(event) => setHeroSlideDraft({ ...heroSlideDraft, endDate: event.target.value })} /></label></div>
                  <div className="admin-actions"><button className="btn btn-primary" type="submit" disabled={(heroSlideDraft.imageMethod === 'url' ? !heroSlideDraft.imageLinkReady : !heroSlideDraft.desktopImage) || (heroSlideDraft.wideImageMethod === 'url' && !!heroSlideDraft.wide_image_url && !heroSlideDraft.wideImageLinkReady) || (heroSlideDraft.mobileImageMethod === 'url' && !!heroSlideDraft.mobile_image_url && !heroSlideDraft.mobileImageLinkReady)}>Save slide</button>{editingHeroSlide && <button className="btn btn-outline" type="button" onClick={() => { setEditingHeroSlide(''); setHeroSlideDraft(newHeroSlideDraft()); }}>Cancel</button>}</div>
                </form>
                <section className="admin-section">
                  <h2>Hero Slider <small>Only the six newest active slides appear on the homepage.</small></h2>
                  <Table headings={['Preview', 'Slide', 'Dates', 'Status', 'Order']}>
                    {data.heroSlides.map((item) => (
                      <tr key={item._id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item._id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveHeroSlide(event.dataTransfer.getData('text/plain'), item._id); }}>
                        <td>{(item.desktopImage || item.image_url) && <img className="hero-slide-table-preview" src={item.desktopImage || item.image_url} alt={item.altText || 'Hero slide'} referrerPolicy={item.image_url ? 'no-referrer' : undefined} />}</td>
                        <td><strong>{item.title || item.altText}</strong><small>{item.description || item.subtitle}</small></td>
                        <td>{item.startDate ? new Date(item.startDate).toLocaleDateString() : 'Any time'} – {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'Any time'}</td>
                        <td>{item.active ? 'Active' : 'Inactive'}</td>
                        <td className="admin-actions">
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => {
                            const legacyDesktopUrl = !item.image_url && /^https:\/\//i.test(item.desktopImage || '');
                            const desktopIsUrl = (!item.desktopImage && !!item.image_url) || legacyDesktopUrl;
                            const wideIsUrl = !item.wideImage && !!item.wide_image_url;
                            const mobileIsUrl = !item.mobileImage && !!item.mobile_image_url;
                            setEditingHeroSlide(item._id);
                            setHeroSlideDraft({
                              ...newHeroSlideDraft(),
                              ...item,
                              show_text: item.show_text === true,
                              title: item.title || '',
                              description: item.description || item.subtitle || '',
                              desktopImage: legacyDesktopUrl ? '' : item.desktopImage,
                              image_url: item.image_url || (legacyDesktopUrl ? item.desktopImage : ''),
                              imageMethod: desktopIsUrl ? 'url' : 'upload',
                              wideImageMethod: wideIsUrl ? 'url' : 'upload',
                              mobileImageMethod: mobileIsUrl ? 'url' : 'upload',
                              startDate: localDateTime(item.startDate),
                              endDate: localDateTime(item.endDate),
                            });
                          }}>Edit</button>
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => runAction(() => adminApi.updateHeroSlide(item._id, { active: !item.active }), item.active ? 'Slide disabled.' : 'Slide enabled.')}>{item.active ? 'Disable' : 'Enable'}</button>
                          <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.deleteHeroSlide(item._id), 'Hero slide deleted.')}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!data.heroSlides.length && <EmptyRow columns={5}>No hero slides have been added.</EmptyRow>}
                  </Table>
                </section>
              </div>
            )}

            {panel === 'ads' && (
              <div className="admin-content-grid">
                <form className="form-card admin-editor" onSubmit={(event) => saveAd(event)}>
                  <h2>{editingAd ? 'Edit advertisement' : 'Create advertisement'}</h2>
                  <p className="text-soft">Upload a real advertiser creative. JPG, PNG or WebP · Maximum 2 MB. Every ad is held for admin approval before publication.</p>
                  <label>Advertiser / alt text<input required value={adDraft.title} onChange={(event) => setAdDraft({ ...adDraft, title: event.target.value })} /></label>
                  <ImageMethodField label="Ad image" uploadValue={adDraft.imageUrl} urlValue={adDraft.image_url} method={adDraft.imageMethod} setMethod={(value) => setAdDraft((current) => ({ ...current, imageMethod: value }))} setUrlValue={(value) => setAdDraft((current) => ({ ...current, image_url: value, imageLinkReady: false }))} urlReady={adDraft.imageLinkReady} setUrlReady={(value) => setAdDraft((current) => ({ ...current, imageLinkReady: value }))} recommendedWidth={480} recommendedHeight={260} onUpload={(event) => updateImageUpload(event, setAdDraft, 'imageUrl', 'imageMethod', 'image_source', 'imageLinkReady', 'Advertisement image')} />
                  <label>Ad title <span className="side-ad-character-count">{adDraft.adTitle.length}/60</span><input maxLength={60} value={adDraft.adTitle} onChange={(event) => setAdDraft({ ...adDraft, adTitle: event.target.value })} /></label>
                  <label>Ad description <span className="side-ad-character-count">{adDraft.description.length}/120</span><textarea maxLength={120} value={adDraft.description} onChange={(event) => setAdDraft({ ...adDraft, description: event.target.value })} /></label>
                  <div className="side-ad-preview">
                    <strong>Live preview</strong>
                    <div className="side-ad-preview-card">
                      {(adDraft.imageMethod === 'url' ? adDraft.image_url : adDraft.imageUrl) && <img className="side-ad-preview-image" src={adDraft.imageMethod === 'url' ? adDraft.image_url : adDraft.imageUrl} alt={adDraft.title || adDraft.adTitle || 'Sponsored advertisement preview'} />}
                      {(adDraft.adTitle || adDraft.description) && <div className="side-ad-preview-copy">{adDraft.adTitle.trim() && <strong className="side-ad-preview-title">{adDraft.adTitle.trim()}</strong>}{adDraft.description.trim() && <span className="side-ad-preview-description">{adDraft.description.trim()}</span>}</div>}
                    </div>
                  </div>
                  <label className="admin-checkbox"><input type="checkbox" checked={adDraft.copy_linked_image} onChange={(event) => setAdDraft({ ...adDraft, copy_linked_image: event.target.checked })} /> Copy linked image to my server</label>
                  <label>Destination link<input required type="url" value={adDraft.link} onChange={(event) => setAdDraft({ ...adDraft, link: event.target.value })} /></label>
                  <div className="admin-field-row">
                    <label>Side<select value={adDraft.side} onChange={(event) => setAdDraft({ ...adDraft, side: event.target.value })}><option value="left">Left</option><option value="right">Right</option><option value="directory">Directory only</option><option value="homepage">Homepage (not shown in side slots)</option></select></label>
                    <label>Position (1-3)<select value={adDraft.sideOrder} onChange={(event) => setAdDraft({ ...adDraft, sideOrder: event.target.value })}><option value="">After positioned ads</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
                  </div>
                  <div className="admin-field-row"><label>Start<input required type="datetime-local" value={adDraft.startAt} onChange={(event) => setAdDraft({ ...adDraft, startAt: event.target.value })} /></label><label>End<input required type="datetime-local" value={adDraft.endAt} onChange={(event) => setAdDraft({ ...adDraft, endAt: event.target.value })} /></label></div>
                  <label className="admin-checkbox"><input type="checkbox" checked={adDraft.enabled} onChange={(event) => setAdDraft({ ...adDraft, enabled: event.target.checked })} /> Enabled</label>
                  <div className="admin-actions"><button className="btn btn-primary" type="submit" disabled={adDraft.imageMethod === 'url' ? !adDraft.imageLinkReady : !adDraft.imageUrl}>Submit for approval</button>{editingAd && <button className="btn btn-outline" type="button" onClick={() => { setEditingAd(''); setAdDraft(newAdDraft()); }}>Cancel</button>}</div>
                </form>
                <section className="admin-section">
                  <h2>Advertisements</h2>
                  {missingApprovedAdSides.length > 0 && <div className="alert alert-warning" role="status">No approved {missingApprovedAdSides.map((side) => side === 'left' ? 'Left' : 'Right').join(' or ')} ad exists. Side ad slots remain available for advertisers.</div>}
                  <Table headings={['Creative', 'Side', 'Status', 'Dates', 'Actions']}>
                  {data.ads.map((item) => {
                    const [statusLabel, statusClass] = adminAdStatus(item);
                    return (
                      <tr key={item._id}>
                        <td>{(item.imageUrl || item.image_url) && <img className="ad-manager-preview" src={item.imageUrl || item.image_url} alt={item.title || 'Ad creative'} referrerPolicy={item.image_url || /^https:\/\//i.test(item.imageUrl || '') ? 'no-referrer' : undefined} />}<strong>{item.title}</strong></td>
                        <td>{normalizedAdSide(item) === 'left' ? 'Left' : normalizedAdSide(item) === 'right' ? 'Right' : normalizedAdSide(item) === 'homepage' ? 'Homepage' : 'Directory'}</td>
                        <td><span className={`ad-status-badge ad-status-${statusClass}`}>{statusLabel}</span></td>
                        <td>{item.startAt ? new Date(item.startAt).toLocaleDateString() : '—'} – {item.endAt ? new Date(item.endAt).toLocaleDateString() : '—'}</td>
                        <td className="admin-actions">
                          <button className="btn btn-outline btn-sm" type="button" onClick={() => {
                            const legacyUrl = !item.image_url && /^https:\/\//i.test(item.imageUrl || '');
                            const side = normalizedAdSide(item) || 'homepage';
                            setEditingAd(item._id);
                            setAdDraft({
                              ...newAdDraft(),
                              ...item,
                              side,
                              placement: side === 'left' ? 'sidebar-left' : side === 'right' ? 'sidebar-right' : side,
                              imageUrl: legacyUrl ? '' : item.imageUrl,
                              image_url: item.image_url || (legacyUrl ? item.imageUrl : ''),
                              imageMethod: item.imageUrl && !legacyUrl ? 'upload' : 'url',
                              adTitle: item.adTitle || '',
                              description: item.description || '',
                              sideOrder: item.sideOrder == null ? '' : String(item.sideOrder),
                              startAt: localDateTime(item.startAt),
                              endAt: localDateTime(item.endAt),
                            });
                          }}>Edit</button>
                          {!(item.approval_status === 'approved' || item.approved === true)
                            ? <button className="btn btn-primary btn-sm" type="button" onClick={() => runAction(() => adminApi.approveAd(item._id), 'Advertisement approved and published.')}>Approve &amp; publish</button>
                            : <button className="btn btn-outline btn-sm" type="button" onClick={() => runAction(() => adminApi.updateAdStatus(item._id, item.status === 'published' ? 'unpublished' : 'published'), item.status === 'published' ? 'Ad unpublished.' : 'Ad published.')}>{item.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
                          <button className="btn btn-danger btn-sm" type="button" onClick={() => runAction(() => adminApi.deleteAd(item._id), 'Advertisement deleted.')}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.ads.length && <EmptyRow columns={5}>No advertisements found.</EmptyRow>}
                </Table></section>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}