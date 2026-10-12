const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Uploaded files are stored as /api/public/uploads/... on the API host.
// The public site is often a different host, so root-relative paths must follow the API origin.
export function mediaUrl(value) {
  if (!value || typeof value !== 'string') return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/api/')) return `${String(API_BASE).replace(/\/api\/?$/, '')}${value}`;
  return value;
}

/**
 * Core fetch wrapper — attaches JWT from localStorage, throws on non-2xx.
 */
export async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    const err = new Error('Unable to connect to the server. Please check your connection.');
    err.isNetworkError = true;
    throw err;
  }

  const responseBody = await response.text().catch(() => '');
  let data = {};
  try {
    data = responseBody ? JSON.parse(responseBody) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const fallbackMessage = response.status >= 500
      ? 'The server could not complete this request. Check that the backend is running and MongoDB is connected.'
      : `Request failed (${response.status}).`;
    const err = new Error(data.message || fallbackMessage);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// -- Auth helpers (localStorage) --
const AUTH_KEY = 'tc_auth';

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    return auth && auth.token && auth.user ? auth : null;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function getAuthToken() {
  return getStoredAuth()?.token ?? null;
}

export function getSession() {
  return getStoredAuth()?.user ?? null;
}

export function saveAuthSession(token, user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_KEY);
}

// -- Convenience API methods --
export const auth = {
  login:          (body) => apiRequest('/auth/login',           { method: 'POST', body: JSON.stringify(body) }),
  register:       (body) => apiRequest('/auth/register',        { method: 'POST', body: JSON.stringify(body) }),
  me:             ()     => apiRequest('/auth/me'),
  changePassword: (body) => apiRequest('/auth/password',        { method: 'PATCH', body: JSON.stringify(body) }),
  forgotPassword: (body) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword:  (body) => apiRequest('/auth/reset-password',  { method: 'POST', body: JSON.stringify(body) }),
};

export const publicApi = {
  businesses:    (params = '') => apiRequest(`/businesses?${params}`),
  business:      (id)          => apiRequest(`/businesses/${id}`),
  jobs:          (params = '') => apiRequest(`/jobs?${params}`),
  job:           (id)          => apiRequest(`/jobs/${id}`),
  news:          (params = '') => apiRequest(`/public/news?${params}`),
  newsItem:      (slug)        => apiRequest(`/public/news/${slug}`),
  offers:        (params = '') => apiRequest(`/public/offers?${params}`),
  communityUpdates: ()        => apiRequest('/community-updates?status=active'),
  // Fetch ads by position: 'left', 'right', 'homepage', 'directory'
  fetchAds:      (position)    => apiRequest(`/public/ads?position=${position}`),
  heroSlides:    ()            => apiRequest('/public/hero-slides'),
  // Legacy: fetch by placement string ('sidebar-left', 'sidebar-right', 'homepage')
  ads:           (placement)   => apiRequest(`/public/ads?placement=${placement}`),
  memberByCode:  (code)        => apiRequest(`/public/member/${code}`),
  memberPublic:  (id)          => apiRequest(`/public/public/${id}`),
};

export const adminApi = {
  dashboard:        ()              => apiRequest('/admin/dashboard'),
  superDashboard:   ()              => apiRequest('/super-admin/dashboard'),
  admins:           ()              => apiRequest('/super-admin/admins'),
  admin:            (id)            => apiRequest(`/super-admin/admins/${id}`),
  createAdmin:      (body)          => apiRequest('/super-admin/admins', { method: 'POST', body: JSON.stringify(body) }),
  updateAdmin:      (id, body)      => apiRequest(`/super-admin/admins/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateAdminStatus: (id, status)   => apiRequest(`/super-admin/admins/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateAdminPermissions: (id, permissions) => apiRequest(`/super-admin/admins/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) }),
  resetAdminPassword: (id, password) => apiRequest(`/super-admin/admins/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  removeAdmin:      (id)            => apiRequest(`/super-admin/admins/${id}`, { method: 'DELETE' }),
  adminActivity:    (p = '')        => apiRequest(`/super-admin/activity?${p}`),
  adminWork:        ()              => apiRequest('/super-admin/work'),
  myActivity:       (p = '')        => apiRequest(`/admin/my-activity?${p}`),
  systemSettings:   ()              => apiRequest('/super-admin/system-settings'),
  reports:          ()              => apiRequest('/super-admin/reports'),
  // users
  users:            (p = '')        => apiRequest(`/admin/users?${p}`),
  user:             (id)            => apiRequest(`/admin/users/${id}`),
  updateUserStatus: (id, status)    => apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateUserRole:   (id, role)      => apiRequest(`/admin/users/${id}/role`,   { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser:       (id)            => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
  // businesses
  businesses:       (p = '')        => apiRequest(`/admin/businesses?${p}`),
  updateBizStatus:  (id, s, rejectionReason = '') => apiRequest(`/admin/businesses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s, rejectionReason }) }),
  deleteBiz:        (id)            => apiRequest(`/admin/businesses/${id}`, { method: 'DELETE' }),
  // chamber
  members:          (p = '')        => apiRequest(`/admin/chamber-members?${p}`),
  approveMember:    (id)            => apiRequest(`/admin/chamber-members/${id}/approve`, { method: 'PATCH' }),
  rejectMember:     (id, rejectionReason = '') => apiRequest(`/admin/chamber-members/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectionReason }) }),
  deleteMember:     (id)            => apiRequest(`/admin/chamber-members/${id}`, { method: 'DELETE' }),
  allMembersQr:     ()              => apiRequest('/admin/all-members-qr'),
  updateQrCodeStatus: (id, status)  => apiRequest(`/admin/qr-codes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  regenerateMemberQr: (id)          => apiRequest(`/admin/chamber-members/${id}/qr/regenerate`, { method: 'POST' }),
  // jobs
  jobs:             (p = '')        => apiRequest(`/admin/jobs?${p}`),
  updateJobStatus:  (id, s, rejectionReason = '') => apiRequest(`/admin/jobs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s, rejectionReason }) }),
  deleteJob:        (id)            => apiRequest(`/admin/jobs/${id}`, { method: 'DELETE' }),
  // applications
  applications:     (p = '')        => apiRequest(`/admin/applications?${p}`),
  updateAppStatus:  (id, s)         => apiRequest(`/admin/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) }),
  // news
  news:             (p = '')        => apiRequest(`/admin/news?${p}`),
  createNews:       (body)          => apiRequest('/admin/news', { method: 'POST', body: JSON.stringify(body) }),
  updateNews:       (id, body)      => apiRequest(`/admin/news/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNews:       (id)            => apiRequest(`/admin/news/${id}`, { method: 'DELETE' }),
  // community updates
  communityUpdates: (p = '')        => apiRequest(`/admin/community-updates?${p}`),
  createCommunityUpdate: (body)      => apiRequest('/admin/community-updates', { method: 'POST', body: JSON.stringify(body) }),
  updateCommunityUpdate: (id, body)  => apiRequest(`/admin/community-updates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateCommunityUpdateStatus: (id, status) => apiRequest(`/admin/community-updates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteCommunityUpdate: (id)        => apiRequest(`/admin/community-updates/${id}`, { method: 'DELETE' }),
  // offers
  offers:           (p = '')        => apiRequest(`/admin/offers?${p}`),
  createOffer:      (body)          => apiRequest('/admin/offers', { method: 'POST', body: JSON.stringify(body) }),
  updateOffer:      (id, body)      => apiRequest(`/admin/offers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOffer:      (id)            => apiRequest(`/admin/offers/${id}`, { method: 'DELETE' }),
  // ads
  ads:              (p = '')        => apiRequest(`/admin/ads?${p}`),
  createAd:         (body)          => apiRequest('/admin/ads', { method: 'POST', body: JSON.stringify(body) }),
  updateAd:         (id, body)      => apiRequest(`/admin/ads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateAdStatus:   (id, status)    => apiRequest(`/admin/ads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  approveAd:       (id)            => apiRequest(`/admin/ads/${id}/approve`, { method: 'PATCH' }),
  deleteAd:         (id)            => apiRequest(`/admin/ads/${id}`, { method: 'DELETE' }),
  heroSlides:       ()              => apiRequest('/admin/hero-slides'),
  probeImageLink:   (url)           => apiRequest('/admin/image-links/probe', { method: 'POST', body: JSON.stringify({ url }) }),
  createHeroSlide:  (body)          => apiRequest('/admin/hero-slides', { method: 'POST', body: JSON.stringify(body) }),
  updateHeroSlide:  (id, body)      => apiRequest(`/admin/hero-slides/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reorderHeroSlides:(ids)           => apiRequest('/admin/hero-slides/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
  deleteHeroSlide:  (id)            => apiRequest(`/admin/hero-slides/${id}`, { method: 'DELETE' }),
  // notifications
  notifications:    ()              => apiRequest('/admin/notifications'),
  markRead:         (id)            => apiRequest(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead:      ()              => apiRequest('/admin/notifications/read-all',   { method: 'PATCH' }),
};

export const shopOwnerApi = {
  dashboard:     ()          => apiRequest('/shop-owner/dashboard'),
  profile:       ()          => apiRequest('/shop-owner/profile'),
  updateProfile: (body)      => apiRequest('/shop-owner/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  business:      ()          => apiRequest('/shop-owner/business'),
  createBiz:     (body)      => apiRequest('/shop-owner/business', { method: 'POST', body: JSON.stringify(body) }),
  updateBiz:     (id, body)  => apiRequest(`/shop-owner/business/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBiz:     (id)        => apiRequest(`/shop-owner/business/${id}`, { method: 'DELETE' }),
  jobs:          ()          => apiRequest('/shop-owner/jobs'),
  createJob:     (body)      => apiRequest('/shop-owner/jobs', { method: 'POST', body: JSON.stringify(body) }),
  updateJob:     (id, body)  => apiRequest(`/shop-owner/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteJob:     (id)        => apiRequest(`/shop-owner/jobs/${id}`, { method: 'DELETE' }),
  closeJob:      (id)        => apiRequest(`/shop-owner/jobs/${id}/close`, { method: 'PATCH' }),
  applications:  ()          => apiRequest('/shop-owner/applications'),
  application:   (id)        => apiRequest(`/shop-owner/applications/${id}`),
  applicationCv: (id)        => apiRequest(`/shop-owner/applications/${id}/cv`),
  updateApplicationStatus: (id, status) => apiRequest(`/shop-owner/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  membership:    ()          => apiRequest('/shop-owner/membership'),
  createMembership: (body)   => apiRequest('/shop-owner/membership', { method: 'POST', body: JSON.stringify(body) }),
  notifications: ()          => apiRequest('/shop-owner/notifications'),
  markRead:      (id)        => apiRequest(`/shop-owner/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead:   ()          => apiRequest('/shop-owner/notifications/read-all', { method: 'PATCH' }),
};

export const jobSeekerApi = {
  dashboard:     ()          => apiRequest('/job-seeker/dashboard'),
  profile:       ()          => apiRequest('/job-seeker/profile'),
  updateProfile: (body)      => apiRequest('/job-seeker/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  getCv:         ()          => apiRequest('/job-seeker/cv'),
  uploadCv:      (body)      => apiRequest('/job-seeker/cv', { method: 'POST', body: JSON.stringify(body) }),
  deleteCv:      ()          => apiRequest('/job-seeker/cv', { method: 'DELETE' }),
  applications:  ()          => apiRequest('/job-seeker/applications'),
  apply:         (body)      => apiRequest('/job-seeker/applications', { method: 'POST', body: JSON.stringify(body) }),
  savedJobs:     ()          => apiRequest('/job-seeker/saved-jobs'),
  saveJob:       (jobId)     => apiRequest(`/job-seeker/saved-jobs/${jobId}`, { method: 'POST' }),
  unsaveJob:     (jobId)     => apiRequest(`/job-seeker/saved-jobs/${jobId}`, { method: 'DELETE' }),
  notifications: ()          => apiRequest('/job-seeker/notifications'),
  markRead:      (id)        => apiRequest(`/job-seeker/notifications/${id}/read`, { method: 'PATCH' }),
};

export const chamberApi = {
  profile:       ()          => apiRequest('/chamber-member/profile'),
  updateProfile: (body)      => apiRequest('/chamber-member/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  membership:    ()          => apiRequest('/chamber-member/membership'),
  updateMembership: (body)   => apiRequest('/chamber-member/membership', { method: 'PATCH', body: JSON.stringify(body) }),
  qr:            ()          => apiRequest('/chamber-member/qr'),
  members:       ()          => apiRequest('/chamber-member/all-active-members'),
  notifications: ()          => apiRequest('/chamber-member/notifications'),
  markRead:      (id)        => apiRequest(`/chamber-member/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead:   ()          => apiRequest('/chamber-member/notifications/read-all', { method: 'PATCH' }),
};
