const PAGE_LINK_MESSAGE = 'This is a page link, not an image. Open the image, right-click, choose "Copy image address", and paste that.';

function isGoogleImagesHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return host === 'google.com'
    || host === 'images.google.com'
    || host === 'google.co.in'
    || /^google\.com\.[a-z.]+$/.test(host)
    || /^google\.co\.[a-z.]+$/.test(host);
}

function validateImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function extractGoogleImageUrl(parsed) {
  const imgurl = parsed.searchParams.get('imgurl');
  if (imgurl) {
    const safe = validateImageUrl(imgurl);
    if (safe) return safe.href;
  }
  if (parsed.pathname === '/url') {
    for (const key of ['url', 'imgurl']) {
      const candidate = parsed.searchParams.get(key);
      const safe = validateImageUrl(candidate);
      if (safe) return safe.href;
    }
  }
  return '';
}

export function convertImageLink(value) {
  const originalUrl = String(value || '').trim();
  let parsed;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return { error: 'Enter a valid HTTPS image link.' };
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return { error: 'Image links must start with https://.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const googleHost = isGoogleImagesHost(hostname);

  if (googleHost && (parsed.pathname === '/imgres' || parsed.pathname.endsWith('/imgres'))) {
    const imageUrl = extractGoogleImageUrl(parsed);
    if (!imageUrl) return { error: 'The Google Images result does not contain a public HTTPS image address.' };
    return { url: imageUrl, converted: imageUrl !== originalUrl };
  }

  if (googleHost && parsed.pathname === '/url') {
    const imageUrl = extractGoogleImageUrl(parsed);
    if (imageUrl) return { url: imageUrl, converted: imageUrl !== originalUrl };
  }

  if (googleHost && parsed.pathname === '/search' && parsed.searchParams.get('tbm') === 'isch') {
    return { error: PAGE_LINK_MESSAGE };
  }

  if (/^encrypted-tbn\d+\.gstatic\.com$/i.test(hostname) && parsed.pathname === '/images') {
    return {
      url: originalUrl,
      converted: false,
      warning: 'This is a low-resolution thumbnail. For a sharp banner, open the image and copy the full-size image address.',
    };
  }

  if (hostname === 'drive.google.com' || hostname === 'www.drive.google.com') {
    const match = /^\/file\/d\/([^/]+)\/view(?:\/|$)/.exec(parsed.pathname);
    if (match) {
      const fileId = decodeURIComponent(match[1]);
      return {
        url: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`,
        converted: true,
        note: 'The file must be shared as Anyone with the link.',
      };
    }
  }

  if (hostname === 'dropbox.com' || hostname.endsWith('.dropbox.com')) {
    if (parsed.searchParams.get('dl') === '0') {
      parsed.searchParams.delete('dl');
      parsed.searchParams.set('raw', '1');
      return { url: parsed.href, converted: true };
    }
  }

  if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com')
    || hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    return { error: PAGE_LINK_MESSAGE };
  }

  return { url: originalUrl, converted: false };
}
