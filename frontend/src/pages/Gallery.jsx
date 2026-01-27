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
        const response = await axios.get('http://localhost:8000/api/apartment/photos', {
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

  if (loading) return <div>Loading photos...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h2>Apartment Gallery</h2>
      
      {/* Photo Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)', // 2 columns
        gap: '16px',
        padding: '16px'
      }}>
        {photos.map((photo, index) => (
          <div 
            key={photo.id || index} 
            style={{
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              border: '1px solid #ddd'
            }}
            onClick={() => handlePhotoClick(index)}
          >
            <img 
              src={`http://localhost:8000/static/photos/${photo.filename}`} 
              alt={photo.description}
              style={{
                width: '100%',
                height: '300px',
                objectFit: 'cover',
                transition: 'transform 0.3s ease'
              }}
              onError={(e) => {
                console.error(`Failed to load image: ${photo.filename}`);
                e.target.style.border = '2px solid red';
                e.target.alt = `Failed to load: ${photo.filename}`;
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '8px',
              textAlign: 'center'
            }}>
              {photo.description}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox for selected photo */}
      {selectedPhotoIndex !== null && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={handleCloseZoom}
        >
          <div 
            style={{
              position: 'relative',
              width: '90vw',
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Navigation and Close Buttons */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transform: 'translateY(-50%)',
              zIndex: 1001
            }}>
              <button 
                onClick={handlePrevPhoto}
                style={{
                  background: 'rgba(0,0,0,0.5)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '15px 20px',
                  borderRadius: '50%',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '10px'
                }}
              >
                ←
              </button>
              <button 
                onClick={handleNextPhoto}
                style={{
                  background: 'rgba(0,0,0,0.5)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '15px 20px',
                  borderRadius: '50%',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '10px'
                }}
              >
                →
              </button>
            </div>

            {/* Close Button */}
            <button 
              onClick={handleCloseZoom}
              style={{
                position: 'absolute',
                top: '-10px',
                right: '0',
                background: 'rgba(255,0,0,0.7)', 
                color: 'white', 
                border: 'none', 
                padding: '10px 15px',
                borderRadius: '0 0 0 4px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
            >
              ✕
            </button>

            {/* Image Container */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <img 
                src={`http://localhost:8000/static/photos/${photos[selectedPhotoIndex].filename}`} 
                alt={photos[selectedPhotoIndex].description}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  console.error(`Failed to load full image: ${photos[selectedPhotoIndex].filename}`);
                  e.target.style.border = '2px solid red';
                  e.target.alt = `Failed to load: ${photos[selectedPhotoIndex].filename}`;
                }}
              />
            </div>

            {/* Description */}
            <div 
              style={{
                position: 'absolute',
                bottom: '-40px',
                left: 0,
                right: 0,
                color: 'white',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.7)',
                padding: '10px'
              }}
            >
              {photos[selectedPhotoIndex].description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

