import { useState, useEffect } from 'react';
import { staticPhotoUrl } from '../photoUtils';

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/apartment/photos?_=${Date.now()}`, {
          cache: 'default',
          credentials: 'same-origin',
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        });
        const raw = await res.json().catch(() => null);
        if (ac.signal.aborted) return;
        if (!res.ok) {
          const msg =
            (raw && typeof raw === 'object' && raw.detail) ||
            res.statusText ||
            'Failed to load photos';
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        setPhotos(Array.isArray(raw) ? raw : []);
      } catch (err) {
        if (ac.signal.aborted) return;
        console.error('Failed to load photos:', err);
        setError(`Failed to load photos: ${err.message || 'unknown error'}`);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  const handlePhotoClick = (index) => {
    setSelectedPhotoIndex(index);
  };

  const handleCloseZoom = (e) => {
    e.stopPropagation();
    setSelectedPhotoIndex(null);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setSelectedPhotoIndex((prevIndex) =>
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setSelectedPhotoIndex((prevIndex) =>
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };

  if (loading) return <div className="gallery-status">Loading photos...</div>;
  if (error) return <div className="gallery-status gallery-status-error">{error}</div>;

  return (
    <div className="gallery-page">
      <h2 className="gallery-title">Apartment Gallery</h2>

      <div className="gallery-grid">
        {photos.map((photo, index) => {
          const src =
            photo.content_url
              ? `${photo.content_url}?v=${encodeURIComponent(String(photo.v ?? ''))}`
              : staticPhotoUrl(photo.filename, photo.v);
          return (
            <div
              key={`${photo.id ?? index}-${photo.filename}-${photo.v ?? ''}`}
              className="gallery-card"
              onClick={() => handlePhotoClick(index)}
            >
              {src ? (
                <img
                  src={src}
                  alt={photo.description}
                  className="gallery-image"
                  decoding="async"
                  onError={(e) => {
                    console.error(`Failed to load image: ${photo.filename}`);
                    e.target.style.border = '2px solid red';
                    e.target.alt = `Failed to load: ${photo.filename}`;
                  }}
                />
              ) : (
                <div className="gallery-image gallery-image-missing">Unavailable</div>
              )}
              <div className="gallery-caption">{photo.description}</div>
            </div>
          );
        })}
      </div>

      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
        <div className="gallery-lightbox" onClick={handleCloseZoom}>
          <div
            className="gallery-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gallery-lightbox-nav">
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="gallery-lightbox-arrow gallery-lightbox-arrow-left"
              >
                ←
              </button>
              <button
                type="button"
                onClick={handleNextPhoto}
                className="gallery-lightbox-arrow gallery-lightbox-arrow-right"
              >
                →
              </button>
            </div>

            <button
              type="button"
              onClick={handleCloseZoom}
              className="gallery-lightbox-close"
            >
              ✕
            </button>

            <div className="gallery-lightbox-image-wrap">
              <img
                src={
                  photos[selectedPhotoIndex].content_url
                    ? `${photos[selectedPhotoIndex].content_url}?v=${encodeURIComponent(String(photos[selectedPhotoIndex].v ?? ''))}`
                    : staticPhotoUrl(
                        photos[selectedPhotoIndex].filename,
                        photos[selectedPhotoIndex].v
                      )
                }
                alt={photos[selectedPhotoIndex].description}
                className="gallery-lightbox-image"
                decoding="async"
              />
            </div>

            <div className="gallery-lightbox-caption">
              {photos[selectedPhotoIndex].description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
