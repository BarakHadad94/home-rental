import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseReservations, setBaseReservations] = useState([]);

  // Separate filter states for current and past reservations
  const emptyFilter = { status: '', startDate: '', endDate: '', name: '' };
  const [currentFilter, setCurrentFilter] = useState(emptyFilter);
  const [pastFilter, setPastFilter] = useState(emptyFilter);
  const [appliedCurrentFilter, setAppliedCurrentFilter] = useState(emptyFilter);
  const [appliedPastFilter, setAppliedPastFilter] = useState(emptyFilter);
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Fetch reservations with optional filtering
  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/reservations');

      // Sort all by check-in desc for consistency (we'll split later)
      const sorted = response.data.sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
      setBaseReservations(sorted);
      setLoading(false);
      return sorted;
    } catch (err) {
      setError('Failed to fetch reservations');
      setLoading(false);
      return [];
    }
  };

  // Initial load
  useEffect(() => {
    fetchReservations();
  }, []);

  // Helper: apply filter set to a list
  const applyFilters = (list, activeFilter) => {
    return list.filter((r) => {
      // Status filter
      if (activeFilter.status && r.status !== activeFilter.status) return false;
      // Date filters: apply to reservation date range
      if (activeFilter.startDate) {
        const start = new Date(activeFilter.startDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(r.check_out) < start) return false;
      }
      if (activeFilter.endDate) {
        const end = new Date(activeFilter.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.check_in) > end) return false;
      }
      // Name filter (case-insensitive, partial)
      if (activeFilter.name && activeFilter.name.trim()) {
        const needle = activeFilter.name.trim().toLowerCase();
        if (!r.guest_name.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  };

  // Split and filter current/past separately
  const { currentReservations, pastReservations } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = [];
    const past = [];
    for (const r of baseReservations) {
      const checkOut = new Date(r.check_out);
      checkOut.setHours(0, 0, 0, 0);
      if (checkOut >= today) current.push(r);
      else past.push(r);
    }

    // Apply respective filters
    const filteredCurrent = applyFilters(current, appliedCurrentFilter);
    const filteredPast = applyFilters(past, appliedPastFilter);

    // Sort current by check-in desc, past by check-out desc
    filteredCurrent.sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
    filteredPast.sort((a, b) => new Date(b.check_out) - new Date(a.check_out));

    return { currentReservations: filteredCurrent, pastReservations: filteredPast };
  }, [baseReservations, appliedCurrentFilter, appliedPastFilter]);

  // Update reservation status
  const updateReservationStatus = async (id, newStatus) => {
    try {
      await axios.put(`/api/admin/reservations/${id}/status`, null, {
        params: { status: newStatus }
      });
      // Refresh reservations after update
      const updatedReservations = await fetchReservations();
      // Find and show the updated reservation in the modal
      const updatedReservation = updatedReservations.find(r => r.id === id);
      if (updatedReservation) {
        setSelectedReservation(updatedReservation);
      }
      // Clear any previous errors on success
      setError(null);
    } catch (err) {
      // Show specific error message from backend
      const errorMessage = err.response?.data?.detail || 'Failed to update reservation status';
      setError(errorMessage);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  };

  // Execute filtering (current)
  const executeCurrentFilter = () => {
    setAppliedCurrentFilter(currentFilter);
  };

  // Reset current filter
  const resetCurrentFilter = () => {
    setCurrentFilter(emptyFilter);
    setAppliedCurrentFilter(emptyFilter);
  };

  // Execute filtering (past)
  const executePastFilter = () => {
    setAppliedPastFilter(pastFilter);
  };

  // Reset past filter
  const resetPastFilter = () => {
    setPastFilter(emptyFilter);
    setAppliedPastFilter(emptyFilter);
  };

  // Check if reservation is in the past
  const isPastReservation = (checkOutDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    return checkOut < today;
  };

  // Check if reservation is an admin block
  const isAdminBlock = (reservation) => {
    return (
      reservation.guest_name === "admin" &&
      reservation.guest_count === 0 &&
      (reservation.total_price === 0 || reservation.total_price === null)
    );
  };

  // Render reservation status with color coding
  const renderStatus = (status, checkOutDate) => {
    const isPast = isPastReservation(checkOutDate);
    const statusColors = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'red',
      past: '#666'
    };
    
    if (isPast) {
      return (
        <span style={{ 
          color: statusColors.past, 
          fontWeight: 'bold',
          fontStyle: 'italic'
        }}>
          {status.toUpperCase()} (PAST)
        </span>
      );
    }
    
    return (
      <span style={{ 
        color: statusColors[status], 
        fontWeight: 'bold' 
      }}>
        {status.toUpperCase()}
      </span>
    );
  };

  const ReservationDetailsModal = ({ reservation, onClose }) => {
    if (!reservation) return null;

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
          padding: '20px',
          borderRadius: '8px',
          width: '500px',
          maxHeight: '80%',
          overflowY: 'auto'
        }}>
          <h2>Reservation Details</h2>
          <p><strong>Guest:</strong> {reservation.guest_name}</p>
          <p><strong>Email:</strong> {reservation.email}</p>
          <p><strong>Phone:</strong> {reservation.phone}</p>
          <p><strong>Dates:</strong> {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}</p>
          <p><strong>Guests:</strong> {reservation.guest_count}</p>
          <p><strong>Total Price:</strong> {reservation.total_price} ILS</p>
          <p><strong>Status:</strong> {renderStatus(reservation.status, reservation.check_out, reservation)}</p>
          
          {/* Simplified special requests */}
          {reservation.special_requests && (
            <p><strong>Special Requests:</strong> {reservation.special_requests}</p>
          )}
          
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
      <h1>Reservation Management</h1>

      {/* Current Reservations Section */}
      <h2 style={{ fontSize: '24px', marginTop: 30, marginBottom: 15, fontWeight: '600' }}>Current Reservations</h2>
      
      {/* Current Reservations Filters */}
      <div style={{ 
        display: 'flex', 
        gap: 10, 
        marginBottom: 20,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: 10,
        border: '1px solid #ddd',
        borderRadius: 8,
        backgroundColor: '#f9f9f9'
      }}>
        <select 
          value={currentFilter.status} 
          onChange={(e) => setCurrentFilter(prev => ({ ...prev, status: e.target.value }))}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <label>
          Start Date:
          <input 
            type="date" 
            value={currentFilter.startDate}
            onChange={(e) => setCurrentFilter(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </label>

        <label>
          End Date:
          <input 
            type="date" 
            value={currentFilter.endDate}
            onChange={(e) => setCurrentFilter(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </label>

        <label>
          Search by Name:
          <input 
            type="text" 
            placeholder="Enter name..."
            value={currentFilter.name}
            onChange={(e) => setCurrentFilter(prev => ({ ...prev, name: e.target.value }))}
            style={{ marginLeft: 5, padding: '3px 5px' }}
          />
        </label>

        <button 
          onClick={executeCurrentFilter}
          style={{ 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            padding: '5px 10px', 
            borderRadius: '4px' 
          }}
        >
          Apply Filter
        </button>

        <button 
          onClick={resetCurrentFilter}
          style={{ 
            backgroundColor: '#f44336', 
            color: 'white', 
            border: 'none', 
            padding: '5px 10px', 
            borderRadius: '4px' 
          }}
        >
          Reset
        </button>
      </div>

      {/* Loading and Error States */}
      {loading && <p>Loading reservations...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Current Reservations Table */}
      {!loading && (
        <div style={{ marginBottom: 50 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <th>Guest Name</th>
                <th>Dates</th>
                <th>Guests</th>
                <th>Total Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentReservations.map((reservation) => (
                <tr 
                  key={reservation.id}
                  style={{ 
                    borderBottom: '1px solid #ddd',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <td>{reservation.guest_name}</td>
                  <td>
                    {formatDate(reservation.check_in)} - 
                    {formatDate(reservation.check_out)}
                  </td>
                  <td>{reservation.guest_count}</td>
                  <td>{reservation.total_price} ILS</td>
                  <td>{renderStatus(reservation.status, reservation.check_out)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {/* For admin blocks: show Cancel if confirmed, or Confirm if cancelled */}
                    {isAdminBlock(reservation) ? (
                      <>
                        {reservation.status === 'cancelled' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateReservationStatus(reservation.id, 'confirmed');
                            }}
                            style={{ marginRight: 5, backgroundColor: 'green', color: 'white' }}
                          >
                            Confirm
                          </button>
                        )}
                        {reservation.status !== 'cancelled' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateReservationStatus(reservation.id, 'cancelled');
                            }}
                            style={{ backgroundColor: 'red', color: 'white' }}
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {/* For regular reservations: show Confirm if not confirmed */}
                        {reservation.status !== 'confirmed' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateReservationStatus(reservation.id, 'confirmed');
                            }}
                            style={{ marginRight: 5, backgroundColor: 'green', color: 'white' }}
                          >
                            Confirm
                          </button>
                        )}
                        {/* Show Cancel for all non-cancelled reservations */}
                        {reservation.status !== 'cancelled' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateReservationStatus(reservation.id, 'cancelled');
                            }}
                            style={{ backgroundColor: 'red', color: 'white' }}
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {currentReservations.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                    No current reservations match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Past Reservations Section */}
      {!loading && (
        <>
          <h2 style={{ fontSize: '24px', marginTop: 40, marginBottom: 15, fontWeight: '600' }}>Past Reservations</h2>
          
          {/* Past Reservations Filters */}
          <div style={{ 
            display: 'flex', 
            gap: 10, 
            marginBottom: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 8,
            backgroundColor: '#f7f7f7'
          }}>
          <select 
            value={pastFilter.status} 
            onChange={(e) => setPastFilter(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <label>
            Start Date:
            <input 
              type="date" 
              value={pastFilter.startDate}
              onChange={(e) => setPastFilter(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label>
            End Date:
            <input 
              type="date" 
              value={pastFilter.endDate}
              onChange={(e) => setPastFilter(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </label>

          <label>
            Search by Name:
            <input 
              type="text" 
              placeholder="Enter name..."
              value={pastFilter.name}
              onChange={(e) => setPastFilter(prev => ({ ...prev, name: e.target.value }))}
              style={{ marginLeft: 5, padding: '3px 5px' }}
            />
          </label>

          <button 
            onClick={executePastFilter}
            style={{ 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              padding: '5px 10px', 
              borderRadius: '4px' 
            }}
          >
            Apply Filter
          </button>

          <button 
            onClick={resetPastFilter}
            style={{ 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              padding: '5px 10px', 
              borderRadius: '4px' 
            }}
          >
            Reset
          </button>
        </div>

        {/* Past Reservations Table */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Guest Name</th>
                <th>Dates</th>
                <th>Guests</th>
                <th>Total Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pastReservations.map((reservation) => (
                <tr 
                  key={reservation.id}
                  style={{ 
                    borderBottom: '1px solid #e6e6e6',
                    cursor: 'pointer',
                    backgroundColor: '#fafafa'
                  }}
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <td style={{ color: '#444' }}>{reservation.guest_name}</td>
                  <td style={{ color: '#444' }}>
                    {formatDate(reservation.check_in)} - 
                    {formatDate(reservation.check_out)}
                  </td>
                  <td style={{ color: '#444' }}>{reservation.guest_count}</td>
                  <td style={{ color: '#444' }}>{reservation.total_price} ILS</td>
                  <td>{renderStatus(reservation.status, reservation.check_out)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: '#888', fontStyle: 'italic' }}>No actions available</span>
                  </td>
                </tr>
              ))}
              {pastReservations.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                    No past reservations match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {selectedReservation && (
        <ReservationDetailsModal 
          reservation={selectedReservation} 
          onClose={() => setSelectedReservation(null)} 
        />
      )}
    </div>
  );
}
