import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import Book from './pages/Book'
import BookingSuccess from './pages/BookingSuccess'
import Gallery from './pages/Gallery'
import AdminDashboard from './pages/AdminDashboard'
import UserDashboard from './pages/UserDashboard'
import AuthModal from './components/AuthModal'
import { staticPhotoUrl } from './photoUtils'
import './App.css'

function HomePage() {
  const [apartment, setApartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminAccessTouches, setAdminAccessTouches] = useState(0);
  const [lastTouchTime, setLastTouchTime] = useState(0);

  useEffect(() => {
    const fetchApartmentInfo = async () => {
      try {
        const res = await fetch(`/apartment?_=${Date.now()}`, {
          cache: 'default',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const detail = data?.detail;
          throw new Error(
            typeof detail === 'string'
              ? detail
              : detail
                ? JSON.stringify(detail)
                : res.statusText || 'Request failed'
          );
        }

        if (!data) {
          throw new Error('No data received from server');
        }

        if (!data.settings && !Object.prototype.hasOwnProperty.call(data, 'settings')) {
          throw new Error('No settings found in response');
        }

        setApartment(data);
        setLoading(false);
      } catch (err) {
        const errorMessage =
          err.message || 'Failed to fetch apartment information';
        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchApartmentInfo();
  }, []);

  const handleAdminAccess = () => {
    const currentTime = new Date().getTime();
    
    // Reset touches if too much time has passed between touches
    if (currentTime - lastTouchTime > 2000) {
      setAdminAccessTouches(1);
    } else {
      setAdminAccessTouches(prev => prev + 1);
    }
    
    setLastTouchTime(currentTime);
  };

  if (loading) return <div className="home-page" style={{ textAlign: 'center', padding: '3rem' }}><p>Loading apartment info...</p></div>;
  
  if (error) return (
    <div className="home-page" style={{ textAlign: 'center', padding: '2rem', color: '#721c24' }}>
      <h2>Error Loading Apartment Information</h2>
      <p>{error}</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  if (!apartment || !apartment.settings) return null;

  const { settings, featured_photo } = apartment;
  const heroSrc =
    featured_photo &&
    (
      featured_photo.content_url
        ? `${featured_photo.content_url}?v=${encodeURIComponent(String(featured_photo.v ?? ''))}`
        : staticPhotoUrl(featured_photo.filename, featured_photo.v)
    );

  const tagline = settings.description ? (settings.description.split('.')[0] + (settings.description.includes('.') ? '.' : '')) : '';
  const introText = settings.description && settings.description.includes('.') ? settings.description.split('.').slice(1).join('.').trim() : '';

  return (
    <>
      {/* Hero: full-width featured photo with overlay + headline + tagline + CTA */}
      <section className="home-hero" style={!featured_photo ? { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' } : undefined}>
        {featured_photo && heroSrc && (
          <img
            key={`hero-${featured_photo.id}-${featured_photo.filename}-${featured_photo.v ?? ''}`}
            className="home-hero-image"
            src={heroSrc}
            alt={featured_photo.description || 'Apartment'}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        {featured_photo && <div className="home-hero-overlay" />}
        <div className="home-hero-content">
          <h1
            className="home-hero-title"
            onTouchStart={handleAdminAccess}
            onClick={handleAdminAccess}
          >
            {settings.apartment_name}
          </h1>
          {tagline && <p className="home-hero-tagline">{tagline}</p>}
          <Link to="/book" className="home-hero-cta">Check availability</Link>
        </div>
      </section>

      <div className="home-page">
        {introText && <p className="home-intro">{introText}</p>}

        <div className="home-included-card">
          <h3>Amenities</h3>
          <ul className="home-amenities">
            <li>2 Bedrooms</li>
            <li>Living room</li>
            <li>Kitchen</li>
            <li>Bathroom</li>
            <li>Garden & Rooftop</li>
            <li>Parking</li>
          </ul>
        </div>

        <div className="home-visit-contact">
          <div className="block">
            <h3>Check-in & Check-out</h3>
            <p><strong>Check-in:</strong> {settings.check_in_time || '14:00'}</p>
            <p><strong>Check-out:</strong> {settings.check_out_time || '11:00'}</p>
          </div>
          <div className="block-divider" aria-hidden="true" />
          <div className="block home-contact">
            <h3>Contact</h3>
            <p><strong>Email:</strong> {settings.contact_email}</p>
            <p><strong>Phone:</strong> {settings.contact_phone}</p>
            <p><strong>Address:</strong> {settings.address}</p>
          </div>
        </div>

        {adminAccessTouches >= 7 && (
          <Link to="/admin" className="home-admin-link">Admin Access</Link>
        )}
      </div>
    </>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIsAdmin, setAuthIsAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    setMobileNavOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    setUser(null);
    setIsAdmin(false);
    setMobileNavOpen(false);
    navigate('/');
  };

  const openAuthModal = (admin = false) => {
    setAuthIsAdmin(admin);
    setShowAuthModal(true);
  };

  return (
      <div className="app-layout">
        <header className="app-header">
          <button
            type="button"
            className="app-mobile-nav-toggle btn-secondary"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-expanded={mobileNavOpen}
            aria-controls="app-main-nav"
          >
            Menu
          </button>
          <nav
            id="app-main-nav"
            className={`app-header-nav ${mobileNavOpen ? 'is-open' : ''}`}
            onClick={(e) => {
              if (e.target.tagName === 'A') setMobileNavOpen(false);
            }}
          >
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
            <span className="app-nav-divider" aria-hidden="true" />
            <NavLink to="/book" className={({ isActive }) => isActive ? 'active' : ''}>Book</NavLink>
            <span className="app-nav-divider" aria-hidden="true" />
            <NavLink to="/gallery" className={({ isActive }) => isActive ? 'active' : ''}>Gallery</NavLink>
            {user && !isAdmin && (
              <>
                <span className="app-nav-divider" aria-hidden="true" />
                <NavLink to="/my-reservations" className={({ isActive }) => isActive ? 'active' : ''}>My Reservations</NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <span className="app-nav-divider" aria-hidden="true" />
                <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Manage Reservations</NavLink>
              </>
            )}
          </nav>
          <div className="app-header-auth">
            {user ? (
              <>
                <span className="username">{user.username}</span>
                <button type="button" onClick={handleLogout} className="btn-secondary app-logout-btn">Logout</button>
              </>
            ) : (
              <button type="button" onClick={() => openAuthModal(false)} className="btn-primary">Login / Sign Up</button>
            )}
          </div>
        </header>

        <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
        </main>

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
