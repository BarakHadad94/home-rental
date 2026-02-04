import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Book from './pages/Book'
import BookingSuccess from './pages/BookingSuccess'
import Gallery from './pages/Gallery'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import AuthModal from './components/AuthModal'
import './App.css'

function HomePage({ user }) {
  const [apartment, setApartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminAccessTouches, setAdminAccessTouches] = useState(0);
  const [lastTouchTime, setLastTouchTime] = useState(0);

  useEffect(() => {
    const fetchApartmentInfo = async () => {
      try {
        console.log('Starting to fetch apartment info...');
        
        const response = await axios.get('/apartment', {
          timeout: 10000,  // 10 seconds timeout
          headers: {
            'Accept': 'application/json'  // Explicitly request JSON
          }
        });
        
        console.log('Full Apartment Info Response:', JSON.stringify(response.data, null, 2));
        console.log('Response Type:', typeof response.data);
        console.log('Response Keys:', Object.keys(response.data));
        
        // Validate response data
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        // More flexible settings check
        if (!response.data.settings && !response.data.hasOwnProperty('settings')) {
          console.error('Unexpected response structure:', response.data);
          throw new Error('No settings found in response');
        }
        
        setApartment(response.data);
        setLoading(false);
      } catch (err) {
        console.error('FULL Error Details:', err);
        
        // More detailed error logging
        if (err.response) {
          // The request was made and the server responded with a status code
          console.error('Server Response Error:', {
            status: err.response.status,
            data: err.response.data,
            headers: err.response.headers,
            type: typeof err.response.data
          });
        } else if (err.request) {
          // The request was made but no response was received
          console.error('No response received:', err.request);
        } else {
          // Something happened in setting up the request
          console.error('Error setting up request:', err.message);
        }
        
        // Determine error message
        const errorMessage = err.response?.data?.detail || 
                             err.message || 
                             'Failed to fetch apartment information';
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchApartmentInfo();
  }, []);

  const handleAdminAccess = (e) => {
    const currentTime = new Date().getTime();
    
    // Reset touches if too much time has passed between touches
    if (currentTime - lastTouchTime > 2000) {
      setAdminAccessTouches(1);
    } else {
      setAdminAccessTouches(prev => prev + 1);
    }
    
    setLastTouchTime(currentTime);
  };

  if (loading) return <p>Loading apartment info...</p>;
  
  if (error) return (
    <div style={{ 
      textAlign: 'center', 
      padding: '20px', 
      backgroundColor: '#f8d7da', 
      color: '#721c24' 
    }}>
      <h2>Error Loading Apartment Information</h2>
      <p>{error}</p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Retry
      </button>
    </div>
  );

  if (!apartment || !apartment.settings) return null;

  const { settings, featured_photo } = apartment;

  // Format time from 24-hour to 12-hour format
  const formatTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12} ${ampm}`;
  };

  return (
    <div className="home-page" style={{ padding: '0 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 
        onTouchStart={handleAdminAccess}
        onClick={handleAdminAccess}
        style={{ 
          userSelect: 'none',
          textAlign: 'center'
        }}
      >
        {settings.apartment_name}
      </h1>
      <p>{settings.description}</p>
      
      {featured_photo && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          margin: '20px 0' 
        }}>
          <img
            src={`/static/photos/${featured_photo.filename}`}
            alt={featured_photo.description || 'Apartment Photo'}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '400px', 
              objectFit: 'contain', 
              borderRadius: '8px' 
            }}
            onError={(e) => {
              console.error('Image load error:', featured_photo.filename);
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Check-in/Check-out Times */}
      <div style={{ 
        backgroundColor: '#e8f4f8', 
        padding: '20px', 
        borderRadius: '8px', 
        marginTop: '20px',
        border: '1px solid #b3d9e6'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Check-in & Check-out</h3>
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ color: '#34495e' }}>Check-in:</strong>
            <span style={{ marginLeft: '8px' }}>Starts at {formatTime(settings.check_in_time || '14:00')}</span>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Check-out:</strong>
            <span style={{ marginLeft: '8px' }}>Until {formatTime(settings.check_out_time || '11:00')}</span>
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div style={{ 
        backgroundColor: '#f9f9f9', 
        padding: '20px', 
        borderRadius: '8px', 
        marginTop: '20px',
        border: '1px solid #e0e0e0'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Property Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <strong style={{ color: '#34495e' }}>Bedrooms:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>2 bedrooms with double beds</p>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Living Space:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>Living room</p>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Kitchen:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>Well-equipped kitchen</p>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Bathroom:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>Bathroom and shower</p>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Outdoor:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>Garden and rooftop</p>
          </div>
          <div>
            <strong style={{ color: '#34495e' }}>Parking:</strong>
            <p style={{ margin: '5px 0 0 0', color: '#555' }}>Available</p>
          </div>
        </div>
      </div>
      
      <div style={{ 
        backgroundColor: '#f4f4f4', 
        padding: '15px', 
        borderRadius: '8px', 
        marginTop: '20px' 
      }}>
        <h3>Contact Information</h3>
        <p><strong>Email:</strong> {settings.contact_email}</p>
        <p><strong>Phone:</strong> {settings.contact_phone}</p>
        <p><strong>Address:</strong> {settings.address}</p>
      </div>

      {adminAccessTouches >= 7 && (
        <Link 
          to="/admin" 
          style={{ 
            display: 'block', 
            textAlign: 'center',
            marginTop: 20, 
            color: 'blue', 
            textDecoration: 'underline'
          }}
        >
          Admin Access
        </Link>
      )}
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIsAdmin, setAuthIsAdmin] = useState(false);

  useEffect(() => {
    // First entry (new tab/window): no session yet → start logged out. Refresh: restore login from localStorage.
    const sessionActive = sessionStorage.getItem('sessionActive');
    if (sessionActive) {
      const userStr = localStorage.getItem('user');
      const adminStr = localStorage.getItem('isAdmin');
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsAdmin(adminStr === 'true' || userData.is_admin);
      }
    } else {
      sessionStorage.setItem('sessionActive', '1');
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAdmin(userData.is_admin || userData.username === 'admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    setUser(null);
    setIsAdmin(false);
    navigate('/');
  };

  const openAuthModal = (admin = false) => {
    setAuthIsAdmin(admin);
    setShowAuthModal(true);
  };

  return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '10px 20px', 
          minHeight: '50px',
          width: '100%',
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          {/* Spacer on left to balance layout */}
          <div style={{ width: '200px', flexShrink: 0 }}></div>
          
          {/* Grey background ONLY for tabs - centered */}
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f4f4f4',
            padding: '10px 30px',
            borderRadius: '4px',
            flex: '0 0 auto'
          }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'blue', whiteSpace: 'nowrap' }}>Home</Link>
            <Link to="/book" style={{ textDecoration: 'none', color: 'blue', whiteSpace: 'nowrap' }}>Book</Link>
            <Link to="/gallery" style={{ textDecoration: 'none', color: 'blue', whiteSpace: 'nowrap' }}>Gallery</Link>
            {user && !isAdmin && (
              <Link to="/my-reservations" style={{ textDecoration: 'none', color: 'blue', whiteSpace: 'nowrap' }}>My Reservations</Link>
            )}
            {isAdmin && (
              <Link to="/admin" style={{ textDecoration: 'none', color: 'blue', whiteSpace: 'nowrap' }}>Manage Reservations</Link>
            )}
          </div>
          
          {/* Login/Logout on the right - NO grey background - ALWAYS on right */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            width: '200px',
            justifyContent: 'flex-end',
            flexShrink: 0
          }}>
            {user ? (
              <>
                <span style={{ color: '#333', fontWeight: '500' }}>{user.username}</span>
                <button 
                  onClick={handleLogout}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => openAuthModal(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </div>

        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/book" element={<Book user={user} />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route 
            path="/my-reservations" 
            element={<UserDashboard />} 
          />
          <Route 
            path="/admin" 
            element={
              isAdmin ? (
                <AdminDashboardWithBack />
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>Please log in as admin to access this page.</p>
                  <button
                    onClick={() => openAuthModal(true)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    Admin Login
                  </button>
                </div>
              )
            } 
          />
        </Routes>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onLogin={handleLogin}
            isAdmin={authIsAdmin}
          />
        )}
      </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AdminDashboardWithBack() {
  return (
    <div>
      <AdminDashboard />
    </div>
  );
}

export default App
