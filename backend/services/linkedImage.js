const dns = require('dns').promises;
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isGoogleImagesHost } = require('../utils/imageLink');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads');

const blockedIpv4Networks = new net.BlockList();
const blockedIpv6Networks = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([address, prefix]) => blockedIpv4Networks.addSubnet(address, prefix, 'ipv4'));
[
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20], ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8],
].forEach(([address, prefix]) => blockedIpv6Networks.addSubnet(address, prefix, 'ipv6'));

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isBlockedAddress(address) {
  const version = net.isIP(address);
  if (!version) return true;
  if (version === 4) return blockedIpv4Networks.check(address, 'ipv4');
  const firstSegment = Number.parseInt(address.split(':')[0] || '0', 16);
  return firstSegment < 0x2000 || firstSegment > 0x3fff || blockedIpv6Networks.check(address, 'ipv6');
}

async function validatePublicImageUrl(value, deadline = Date.now() + 5000) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw requestError('Enter a valid image URL.');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[(.*)\]$/, '$1');
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !hostname
    || (parsed.port && parsed.port !== '443')
    || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw requestError('Image links must use a public HTTPS URL.');
  }
  const literalIp = net.isIP(hostname);
  let addresses;
  try {
    if (literalIp) {
      addresses = [{ address: hostname, family: literalIp }];
    } else {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw requestError('Image download timed out after 5 seconds.');
      let dnsTimer;
      addresses = await Promise.race([
        dns.lookup(hostname, { all: true, verbatim: true }),
        new Promise((_, reject) => {
          dnsTimer = setTimeout(() => reject(requestError('Image download timed out after 5 seconds.')), remaining);
        }),
      ]).finally(() => clearTimeout(dnsTimer));
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw requestError('The image host could not be resolved.', 400);
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw requestError('Image URLs cannot point to localhost or private network addresses.');
  }
  return { parsed, addresses };
}

function imageRequestHeaders(parsed) {
  const hostname = parsed.hostname.toLowerCase();
  const headers = {
    Accept: 'image/jpeg,image/png,image/webp,image/gif',
    'Accept-Encoding': 'identity',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  if (isGoogleImagesHost(hostname)
    || hostname.endsWith('.googleusercontent.com')
    || hostname.endsWith('.gstatic.com')) {
    headers.Referer = 'https://www.google.com/';
  }
  return headers;
}

function readImageDimensions(buffer, contentType) {
  if (!buffer || buffer.length < 10) return null;
  if (contentType === 'image/png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (contentType === 'image/gif' && buffer.length >= 10 && (buffer.toString('ascii', 0, 3) === 'GIF')) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (contentType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segmentLength;
    }
  }
  return null;
}

function requestImage(url, addresses, redirects = 0, deadline = Date.now() + 5000) {
  return new Promise((resolve, reject) => {
    const timeout = deadline - Date.now();
    if (timeout <= 0) return reject(requestError('Image download timed out after 5 seconds.', 400));
    const { parsed } = url;
    const lookup = (_hostname, options, callback) => {
      const address = addresses[0];
      if (options && options.all) return callback(null, addresses);
      callback(null, address.address, address.family);
    };
    const request = https.get(parsed, {
      timeout,
      lookup,
      headers: imageRequestHeaders(parsed),
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects >= 3) return reject(requestError('The image URL redirected too many times.'));
        let redirected;
        try {
          redirected = new URL(response.headers.location, parsed);
        } catch {
          return reject(requestError('The image server returned an invalid redirect URL.'));
        }
        validatePublicImageUrl(redirected.href, deadline)
          .then((safeUrl) => requestImage(safeUrl, safeUrl.addresses, redirects + 1, deadline))
          .then(resolve, reject);
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(requestError(`The image server returned HTTP ${response.statusCode}.`));
      }
      const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(contentType)) {
        response.resume();
        return reject(requestError('The linked file is not a supported image type.'));
      }
      const declaredSize = Number(response.headers['content-length']);
      if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
        response.resume();
        return reject(requestError('The linked image must be 2 MB or smaller.'));
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) {
          request.destroy(requestError('The linked image must be 2 MB or smaller.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
      response.on('error', reject);
    });
    const deadlineTimer = setTimeout(() => request.destroy(requestError('Image download timed out after 5 seconds.', 400)), timeout);
    request.on('close', () => clearTimeout(deadlineTimer));
    request.on('timeout', () => request.destroy(requestError('Image download timed out after 5 seconds.', 400)));
    request.on('error', reject);
  });
}

async function downloadPublicImage(value) {
  const deadline = Date.now() + 5000;
  const safeUrl = await validatePublicImageUrl(value, deadline);
  return requestImage(safeUrl, safeUrl.addresses, 0, deadline);
}

async function storeLinkedImage(value) {
  return storeDownloadedImage(await downloadPublicImage(value));
}

async function storeDownloadedImage({ buffer, contentType }) {
  const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[contentType];
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.promises.mkdir(UPLOAD_DIRECTORY, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIRECTORY, filename), buffer, { flag: 'wx' });
  return `/api/public/uploads/${filename}`;
}

module.exports = {
  validatePublicImageUrl,
  downloadPublicImage,
  storeLinkedImage,
  storeDownloadedImage,
  readImageDimensions,
  UPLOAD_DIRECTORY,
};
