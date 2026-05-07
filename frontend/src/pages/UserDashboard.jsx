import React, { useState, useEffect } from 'react';
import axios from 'axios';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function UserDashboard() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Get user from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
      fetchReservations(user.id);
    } else {
      setError('Please log in to view your reservations');
      setLoading(false);
    }
  }, []);

  const fetchReservations = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/auth/user/${id}/reservations`);
      
      // Separate past and current reservations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const currentReservations = response.data.filter(r => {
        const checkOut = new Date(r.check_out);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut >= today;
      });
      
      const pastReservations = response.data.filter(r => {
        const checkOut = new Date(r.check_out);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut < today;
      });
      
      // Sort current by check-in (most recent first)
      currentReservations.sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
      // Sort past by check-out (most recent first)
      pastReservations.sort((a, b) => new Date(b.check_out) - new Date(a.check_out));
      
      setReservations([...currentReservations, ...pastReservations]);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch reservations');
      setLoading(false);
    }
  };

  const renderStatus = (status) => {
    const statusColors = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'red'
    };
    return (
      <span style={{ 
        color: statusColors[status] || 'gray', 
        fontWeight: 'bold' 
      }}>
        {status.toUpperCase()}
      </span>
    );
  };

  const isPastReservation = (checkOutDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    return checkOut < today;
  };

  const currentReservations = reservations.filter(r => !isPastReservation(r.check_out));
  const pastReservations = reservations.filter(r => isPastReservation(r.check_out));

  if (loading) return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}><p>Loading your reservations...</p></div>;
  if (error) return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}><p style={{ color: 'red' }}>{error}</p></div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
      <h1 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>My Reservations</h1>

      {/* Current Reservations */}
      {currentReservations.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: '24px', marginBottom: 15, fontWeight: '600' }}>Current Reservations</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <th>Dates</th>
                <th>Guests</th>
                <th>Total Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentReservations.map(reservation => (
                <tr 
                  key={reservation.id}
                  style={{ 
                    borderBottom: '1px solid #ddd',
                    backgroundColor: 'white'
                  }}
                >
                  <td>
                    {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}
                  </td>
                  <td>{reservation.guest_count}</td>
                  <td>{reservation.total_price} ILS</td>
                  <td>{renderStatus(reservation.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Past Reservations */}
      {pastReservations.length > 0 && (
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: 15, fontWeight: '600' }}>Past Reservations</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Dates</th>
                <th>Guests</th>
                <th>Total Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pastReservations.map(reservation => (
                <tr 
                  key={reservation.id}
                  style={{ 
                    borderBottom: '1px solid #e6e6e6',
                    backgroundColor: '#fafafa',
                    opacity: 0.8
                  }}
                >
                  <td style={{ color: '#444' }}>
                    {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}
                  </td>
                  <td style={{ color: '#444' }}>{reservation.guest_count}</td>
                  <td style={{ color: '#444' }}>{reservation.total_price} ILS</td>
                  <td>{renderStatus(reservation.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reservations.length === 0 && (
        <p>You don't have any reservations yet.</p>
      )}
    </div>
  );
}