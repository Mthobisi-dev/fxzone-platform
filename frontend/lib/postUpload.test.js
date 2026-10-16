const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadPostUpload() {
  return import('./postUpload.ts');
}

test('routes files over the Vercel request-body limit to a direct signed upload', async () => {
  const { DIRECT_POST_UPLOAD_THRESHOLD_BYTES, shouldUseDirectPostUpload } = await loadPostUpload();

  assert.equal(shouldUseDirectPostUpload(DIRECT_POST_UPLOAD_THRESHOLD_BYTES, 'image/jpeg'), false);
  assert.equal(shouldUseDirectPostUpload(DIRECT_POST_UPLOAD_THRESHOLD_BYTES + 1, 'image/jpeg'), true);
});

test('routes every video directly to Storage so multi-video posts bypass function body and duration limits', async () => {
  const { shouldUseDirectPostUpload } = await loadPostUpload();

  assert.equal(shouldUseDirectPostUpload(256_000, 'video/mp4'), true);
  assert.equal(shouldUseDirectPostUpload(256_000, 'video/webm'), true);
  assert.equal(shouldUseDirectPostUpload(0, 'video/mp4'), false);
});

test('uses media-specific post attachment limits', async () => {
  const { getPostMediaSizeLimit, isAllowedPostMedia } = await loadPostUpload();

  assert.equal(getPostMediaSizeLimit('image/jpeg'), 10 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('application/pdf'), 20 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('audio/webm'), 25 * 1024 * 1024);
  assert.equal(getPostMediaSizeLimit('video/mp4'), 100 * 1024 * 1024);
  assert.equal(isAllowedPostMedia('video/mp4', 100 * 1024 * 1024), true);
  assert.equal(isAllowedPostMedia('video/mp4', 100 * 1024 * 1024 + 1), false);
  assert.equal(isAllowedPostMedia('text/plain', 10), false);
});

test('detects supported attachment content and normalizes inaccurate browser media types', async () => {
  const { detectPostMediaType, resolvePostMediaType } = await loadPostUpload();
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(detectPostMediaType(png), 'image/png');
  assert.equal(resolvePostMediaType('image/jpeg', png), 'image/png');
  assert.equal(resolvePostMediaType('application/octet-stream', png), 'image/png');
});

test('accepts valid MP4 and PDF signatures beyond byte zero while rejecting unsupported content', async () => {
  const { detectPostMediaType } = await loadPostUpload();
  const leadingBoxMp4 = Uint8Array.from([
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65,
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
  ]);
  const pdfWithLeadingComment = new TextEncoder().encode('% generated\n%PDF-1.7\n');

  assert.equal(detectPostMediaType(leadingBoxMp4), 'video/mp4');
  assert.equal(detectPostMediaType(pdfWithLeadingComment), 'application/pdf');
  assert.equal(detectPostMediaType(new TextEncoder().encode('plain text')), null);
});
