import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReservationAdmin = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  // New state for detailed view
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Hardcoded admin password (you should replace this with a more secure method)
  const ADMIN_PASSWORD = 'rental2024';

  // Fetch reservations from backend
  const fetchReservations = async () => {
    try {
      const response = await axios.get('http://localhost:8000/reservations');
      setReservations(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch reservations');
      setLoading(false);
    }
  };

  // Update reservation status
  const updateReservationStatus = async (reservationId, newStatus) => {
    try {
      await axios.put(`http://localhost:8000/reservations/${reservationId}/status`, { status: newStatus });
      // Refresh reservations after update
      fetchReservations();
      // Close the detailed view if it was open
      setSelectedReservation(null);
    } catch (err) {
      setError('Failed to update reservation status');
    }
  };

  // Handle password submission
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchReservations();
    } else {
      alert('Incorrect password');
    }
  };

  // Filter reservations based on status
  const filteredReservations = reservations.filter(reservation => 
    filterStatus === 'all' || reservation.status === filterStatus
  );

  // Render login form
  const renderLoginForm = () => (
    <div className="admin-login">
      <h2>Admin Login</h2>
      <form onSubmit={handlePasswordSubmit}>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password"
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );

  // Render detailed reservation modal
  const renderReservationModal = () => {
    if (!selectedReservation) return null;

    return (
      <div className="reservation-modal-overlay">
        <div className="reservation-modal">
          <h2>Reservation Details</h2>
          <div className="reservation-details">
            <p><strong>Guest Name:</strong> {selectedReservation.guest_name}</p>
            <p><strong>Email:</strong> {selectedReservation.email}</p>
            <p><strong>Phone:</strong> {selectedReservation.phone || 'Not provided'}</p>
            <p><strong>Check-In:</strong> {selectedReservation.check_in}</p>
            <p><strong>Check-Out:</strong> {selectedReservation.check_out}</p>
            <p><strong>Guest Count:</strong> {selectedReservation.guest_count}</p>
            <p><strong>Status:</strong> {selectedReservation.status}</p>
            <p><strong>Special Requests:</strong> {selectedReservation.message || 'None'}</p>
            <p><strong>Booking Date:</strong> {selectedReservation.created_at}</p>
          </div>
          <div className="reservation-modal-actions">
            {selectedReservation.status !== 'confirmed' && (
              <button 
                onClick={() => updateReservationStatus(selectedReservation.id, 'confirmed')}
              >
                Confirm Reservation
              </button>
            )}
            {selectedReservation.status !== 'cancelled' && (
              <button 
                onClick={() => updateReservationStatus(selectedReservation.id, 'cancelled')}
              >
                Cancel Reservation
              </button>
            )}
            <button onClick={() => setSelectedReservation(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render reservations table
  const renderReservationsTable = () => {
    if (loading) return <div>Loading reservations...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
      <div className="reservation-admin">
        <h1>Reservation Management</h1>
        
        {/* Status Filter */}
        <div className="reservation-filters">
          <label>
            Filter by Status:
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Reservations</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Guest Name</th>
              <th>Email</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>{reservation.guest_name}</td>
                <td>{reservation.email}</td>
                <td>{reservation.check_in}</td>
                <td>{reservation.check_out}</td>
                <td>{reservation.status}</td>
                <td>
                  <button onClick={() => setSelectedReservation(reservation)}>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {isAuthenticated ? renderReservationsTable() : renderLoginForm()}
      {selectedReservation && renderReservationModal()}
    </div>
  );
};

export default ReservationAdmin;
