import assert from 'node:assert/strict';
import test from 'node:test';
import { convertImageLink } from './imageLink.js';

test('extracts the full image URL from Google Images result links', () => {
  const imageUrl = 'https://cdn.example.com/photo.jpg?width=800&crop=center';
  const resultUrl = `https://www.google.com/imgres?${new URLSearchParams({ imgurl: imageUrl, imgrefurl: 'https://example.com' })}`;
  assert.equal(convertImageLink(resultUrl).url, imageUrl);

  const regionalResult = `https://www.google.com.au/imgres?${new URLSearchParams({ imgurl: imageUrl })}`;
  assert.equal(convertImageLink(regionalResult).url, imageUrl);
  assert.equal(convertImageLink(`https://www.google.co.in/imgres?${new URLSearchParams({ imgurl: imageUrl })}`).url, imageUrl);
  assert.equal(convertImageLink(`https://images.google.com/imgres?${new URLSearchParams({ imgurl: imageUrl })}`).url, imageUrl);
});

test('extracts image URLs from Google redirect links', () => {
  const imageUrl = 'https://cdn.example.com/photo.webp';
  const redirect = `https://www.google.com/url?${new URLSearchParams({ sa: 'i', url: imageUrl })}`;
  assert.equal(convertImageLink(redirect).url, imageUrl);
});

test('warns when using a Google Images thumbnail', () => {
  const result = convertImageLink('https://encrypted-tbn0.gstatic.com/images?q=tbn:example');
  assert.equal(result.url, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:example');
  assert.match(result.warning, /low-resolution thumbnail/);
});

test('converts Google Drive and Dropbox share links', () => {
  assert.deepEqual(
    convertImageLink('https://drive.google.com/file/d/abc123/view?usp=sharing'),
    {
      url: 'https://drive.google.com/uc?export=view&id=abc123',
      converted: true,
      note: 'The file must be shared as Anyone with the link.',
    },
  );
  assert.equal(
    convertImageLink('https://www.dropbox.com/s/abc/photo.jpg?dl=0').url,
    'https://www.dropbox.com/s/abc/photo.jpg?raw=1',
  );
});

test('accepts direct images with query strings and extensionless image addresses', () => {
  const knownGoodUrl = 'https://www.gstatic.com/webp/gallery/1.jpg';
  assert.equal(convertImageLink(knownGoodUrl).url, knownGoodUrl);
  assert.equal(convertImageLink('https://images.example.com/render?id=123').url, 'https://images.example.com/render?id=123');
  assert.equal(convertImageLink('https://images.example.com/photo.jpg?w=800').url, 'https://images.example.com/photo.jpg?w=800');
  assert.equal(convertImageLink('https://lh3.googleusercontent.com/abc123=w1200').url, 'https://lh3.googleusercontent.com/abc123=w1200');
});

test('rejects page links and insecure image links with actionable messages', () => {
  const searchResult = convertImageLink('https://www.google.com/search?tbm=isch&q=photo');
  assert.match(searchResult.error, /This is a page link, not an image/);
  assert.match(convertImageLink('https://www.facebook.com/photo.php?id=1').error, /This is a page link, not an image/);
  assert.match(convertImageLink('http://images.example.com/photo.jpg').error, /https:\/\//);
});
