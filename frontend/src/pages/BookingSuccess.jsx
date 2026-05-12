import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BookingSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = window.innerWidth <= 576;

  // Extract booking details from location state
  const { 
    guest_name = 'Guest', 
    check_in, 
    check_out, 
    nights = 1, 
    total_price = 0,
    guest_count = 1
  } = location.state || {};

  // Format dates to dd MM YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const handleOkay = () => {
    // Navigate back to home page
    navigate('/');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      padding: isMobile ? '12px' : '20px',
      backgroundColor: '#f0f8ff'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: isMobile ? '20px' : '40px',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{ color: '#4CAF50', marginBottom: '20px', fontSize: isMobile ? '1.5rem' : '2rem' }}>Booking Submitted!</h1>
        
        <p style={{ fontSize: isMobile ? '16px' : '18px', marginBottom: '15px' }}>
          <strong>Welcome, {guest_name}!</strong>
        </p>
        
        <div style={{ 
          backgroundColor: '#f4f4f4', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p>Check-in: <strong>{formatDate(check_in)}</strong></p>
          <p>Check-out: <strong>{formatDate(check_out)}</strong></p>
          <p>Number of Nights: <strong>{nights}</strong></p>
          <p>Number of Guests: <strong>{guest_count}</strong></p>
          <p>Total Price: <strong>{total_price} ILS</strong></p>
        </div>
        
        <p style={{ marginBottom: '25px', color: '#666', whiteSpace: 'pre-line' }}>
          Your reservation has been submitted successfully.
          After the host approves your booking, you will receive a confirmation email.
        </p>
        
        <button 
          onClick={handleOkay}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
        >
          Okay, return to home
        </button>
      </div>
    </div>
  );
}
