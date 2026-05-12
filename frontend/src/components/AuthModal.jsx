import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function AuthModal({ onClose, onLogin, isAdmin = false }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 576);
  const navigate = useNavigate();

  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 576);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      // Sign up validation
      if (!formData.username || !formData.email || !formData.password) {
        setError('All fields are required');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 3) {
        setError('Password must be at least 3 characters');
        return;
      }

      try {
        setLoading(true);
        const response = await axios.post('/api/auth/signup', {
          username: formData.username,
          email: formData.email,
          password: formData.password
        });

        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('isAdmin', 'false');
        
        if (onLogin) {
          onLogin(response.data);
        }
        
        onClose();
        navigate('/');
      } catch (err) {
        setError(err.response?.data?.detail || 'Sign up failed');
      } finally {
        setLoading(false);
      }
    } else {
      // Login
      if (!formData.username || !formData.password) {
        setError('Username and password are required');
        return;
      }

      try {
        setLoading(true);
        
        if (isAdmin) {
          const response = await axios.post('/api/admin/login', {
            username: formData.username,
            password: formData.password
          });
          
          if (response.data.access === 'granted') {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            localStorage.setItem('isAdmin', 'true');
            if (onLogin) {
              onLogin(response.data.user);
            }
            onClose();
            navigate('/admin');
          }
        } else {
          const response = await axios.post('/api/auth/login', {
            username: formData.username,
            password: formData.password
          });
          
          localStorage.setItem('user', JSON.stringify(response.data));
          // Check if user is admin based on response
          const isAdminUser = response.data.is_admin || response.data.username === 'admin';
          localStorage.setItem('isAdmin', String(isAdminUser));
          
          if (onLogin) {
            onLogin(response.data);
          }
          
          onClose();
          // Navigate to admin dashboard if admin, otherwise home
          if (isAdminUser) {
            navigate('/admin');
          } else {
            navigate('/');
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Login failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: isMobile ? '18px' : '30px',
        borderRadius: '8px',
        width: isMobile ? '94vw' : '400px',
        maxWidth: '90%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>{isSignUp ? 'Sign Up' : (isAdmin ? 'Admin Login' : 'Login')}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              minWidth: '44px',
              minHeight: '44px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        {!isAdmin && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsSignUp(false)}
              style={{
                flex: 1,
                padding: isMobile ? '12px 8px' : '8px',
                backgroundColor: !isSignUp ? '#4CAF50' : '#e0e0e0',
                color: !isSignUp ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              style={{
                flex: 1,
                padding: isMobile ? '12px 8px' : '8px',
                backgroundColor: isSignUp ? '#4CAF50' : '#e0e0e0',
                color: isSignUp ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 15 }}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>
          {isSignUp && (
            <div style={{ marginBottom: 15 }}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ marginBottom: 15 }}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>
          {isSignUp && (
            <div style={{ marginBottom: 15 }}>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {error && <p style={{ color: 'red', marginBottom: 15 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: loading ? '#cccccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (isSignUp ? 'Signing up...' : 'Logging in...') : (isSignUp ? 'Sign Up' : 'Login')}
          </button>
        </form>
      </div>
    </div>
  );
}