import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Login({ onLogin, isAdmin = false }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    if (!formData.username || !formData.password) {
      setError('Username and password are required');
      return;
    }

    try {
      setLoading(true);
      
      if (isAdmin) {
        // Admin login
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
          // Navigate to admin dashboard
          navigate('/admin');
        }
      } else {
        // Regular user login
        const response = await axios.post('/api/auth/login', {
          username: formData.username,
          password: formData.password
        });
        
        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('isAdmin', 'false');
        
        if (onLogin) {
          onLogin(response.data);
        }
        
        // Navigate to home
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, width: '94vw', margin: 'auto', padding: 20, boxSizing: 'border-box' }}>
      <h2>{isAdmin ? 'Admin Login' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>
        <div style={{ marginBottom: 15 }}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>
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
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {!isAdmin && (
        <p style={{ marginTop: 15, textAlign: 'center' }}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      )}
    </div>
  );
}