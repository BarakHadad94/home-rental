/** URL for a photo on the backend (encode & in filenames; optional v = server mtime). */
export function staticPhotoUrl(filename, v) {
  if (!filename) return '';
  const base = `/static/photos/${encodeURIComponent(filename)}`;
  if (v != null && v !== '') return `${base}?v=${encodeURIComponent(String(v))}`;
  return base;
}
