import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await axios.get('/api/apartment/photos', {
          timeout: 10000
        });
        
        setPhotos(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load photos:', err);
        setError(`Failed to load photos: ${err.message}`);
        setLoading(false);
      }
    };

    fetchPhotos();
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
      
      {/* Photo Grid */}
      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <div
            key={photo.id || index} 
            className="gallery-card"
            onClick={() => handlePhotoClick(index)}
          >
            <img
              src={`/static/photos/${photo.filename}`} 
              alt={photo.description}
              className="gallery-image"
              onError={(e) => {
                console.error(`Failed to load image: ${photo.filename}`);
                e.target.style.border = '2px solid red';
                e.target.alt = `Failed to load: ${photo.filename}`;
              }}
            />
            <div className="gallery-caption">
              {photo.description}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox for selected photo */}
      {selectedPhotoIndex !== null && (
        <div 
          className="gallery-lightbox"
          onClick={handleCloseZoom}
        >
          <div 
            className="gallery-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Navigation and Close Buttons */}
            <div className="gallery-lightbox-nav">
              <button 
                onClick={handlePrevPhoto}
                className="gallery-lightbox-arrow gallery-lightbox-arrow-left"
              >
                ←
              </button>
              <button 
                onClick={handleNextPhoto}
                className="gallery-lightbox-arrow gallery-lightbox-arrow-right"
              >
                →
              </button>
            </div>

            {/* Close Button */}
            <button 
              onClick={handleCloseZoom}
              className="gallery-lightbox-close"
            >
              ✕
            </button>

            {/* Image Container */}
            <div className="gallery-lightbox-image-wrap">
              <img 
                src={`/static/photos/${photos[selectedPhotoIndex].filename}`} 
                alt={photos[selectedPhotoIndex].description}
                className="gallery-lightbox-image"
                onError={(e) => {
                  console.error(`Failed to load full image: ${photos[selectedPhotoIndex].filename}`);
                  e.target.style.border = '2px solid red';
                  e.target.alt = `Failed to load: ${photos[selectedPhotoIndex].filename}`;
                }}
              />
            </div>

            {/* Description */}
            <div className="gallery-lightbox-caption">
              {photos[selectedPhotoIndex].description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

