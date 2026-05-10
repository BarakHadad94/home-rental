import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(isoStr) {
  // Convert YYYY-MM-DD -> DD - MM - YYYY for display
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d} - ${m} - ${y}`;
}

function addDays(date, days) {
  const dt = new Date(date);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function diffNights(startStr, endStr) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(startStr);
  const end = new Date(endStr);
  return Math.round((end - start) / msPerDay);
}

function calculatePrice(nights, guests, checkIn, checkOut) {
  // Base price is for 1-2 guests; each additional guest adds 100 ILS per night (up to 6).
  const guestCount = Math.min(Math.max(guests, 1), 6);
  const dayPrice = 500 + Math.max(guestCount - 2, 0) * 100;

  // Check for weekend/Friday nights
  let totalPrice = 0;
  let currentDate = new Date(checkIn);
  const endDate = new Date(checkOut);

  while (currentDate < endDate) {
    const isFriday = currentDate.getDay() === 5; // 0=Sunday, 5=Friday
    const nightPrice = isFriday ? dayPrice + 100 : dayPrice;
    
    totalPrice += nightPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalPrice;
}

export default function Book({ user }) {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  // Check if user is admin
  const isAdmin = React.useMemo(() => {
    if (!user) return false;
    const adminStr = localStorage.getItem('isAdmin');
    return adminStr === 'true' || user.is_admin || user.username === 'admin';
  }, [user]);

  const [availability, setAvailability] = useState([]); // current month
  const [availabilityCache, setAvailabilityCache] = useState({}); // dateStr -> is_available
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // only for load/submission errors
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionType, setSubmissionType] = useState(''); // 'success' or 'error'

  const [checkIn, setCheckIn] = useState(null); // string YYYY-MM-DD
  const [checkOut, setCheckOut] = useState(null); // string YYYY-MM-DD
  const [rangeError, setRangeError] = useState('');

  // Update form state
  const [form, setForm] = useState({
    guest_name: '',
    email: user ? user.email : '',  // Use user's email if logged in
    phone: '',
    guest_count: 2,  // Default to 2 guests
    message: '',
    special_requests: ''
  });

  // Update email when user changes
  useEffect(() => {
    if (user && user.email) {
      setForm(prev => ({ ...prev, email: user.email }));
    }
  }, [user]);

  // Update field errors
  const [fieldErrors, setFieldErrors] = useState({
    guest_name: '',
    email: '',
    phone: '',
    guest_count: '',
    special_requests: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Calculate total price when guests or dates change
  const totalPrice = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return calculatePrice(
      diffNights(checkIn, checkOut), 
      form.guest_count, 
      checkIn, 
      checkOut
    );
  }, [checkIn, checkOut, form.guest_count]);

  // Load monthly availability for current month
  useEffect(() => {
    setLoading(true);
    setError('');
    
    // Add full URL and error logging
    axios
      .get('/api/availability/calendar', { 
        params: { year, month },
        // Add timeout and error handling
        timeout: 10000  // 10 seconds timeout
      })
      .then((res) => {
        const monthAvail = res.data.availability || [];
        setAvailability(monthAvail);
        
        // Update cache (dateStr -> is_available)
        setAvailabilityCache((prev) => {
          const next = { ...prev };
          for (const item of monthAvail) {
            const key = typeof item.date === 'string' ? item.date : formatDate(new Date(item.date));
            next[key] = Boolean(item.is_available);
          }
          return next;
        });
        
        setLoading(false);
      })
      .catch((err) => {
        // More detailed error logging
        console.error('Availability loading error:', err);
        
        // Provide more specific error message
        const errorMsg = err.response 
          ? (err.response.data.detail || 'Failed to load availability')
          : err.message || 'Network error loading availability';
        
        setError(errorMsg);
        setLoading(false);
      })
  }, [year, month]);

  // Map for quick lookup (current month only)
  const availabilityMap = useMemo(() => {
    const map = {};
    for (const item of availability) {
      const key = typeof item.date === 'string' ? item.date : formatDate(new Date(item.date));
      map[key] = item;
    }
    return map;
  }, [availability]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0); // last day of month
    const daysInMonth = lastOfMonth.getDate();

    const startWeekday = firstOfMonth.getDay(); // 0=Sun ... 6=Sat
    const leadingBlanks = startWeekday; // start weeks on Sunday

    const cells = [];
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ type: 'blank', key: `b-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = formatDate(dateObj);
      const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isAvail = availabilityMap[dateStr]?.is_available === true;
      cells.push({ type: 'day', day, dateStr, isPast, isAvail });
    }
    return cells;
  }, [year, month, availabilityMap]);

  const inSelectedRange = (dateStr) => {
    if (!checkIn || !checkOut) return false;
    return dateStr >= checkIn && dateStr <= checkOut;
  };

  const isSelectableCheckIn = (cell) => {
    if (cell.type !== 'day') return false;
    return !cell.isPast && cell.isAvail;
  };

  const isRangeFullyAvailable = (startStr, endStr) => {
    // We require availability for the nights being stayed:
    // from check-in date up to (but NOT including) the checkout date.
    let dt = new Date(startStr);
    const end = new Date(endStr);
    while (dt < end) { // exclude checkout date
      const key = formatDate(dt);
      // Treat missing cache entries as unavailable to be safe
      if (availabilityCache[key] !== true) return false;
      dt = addDays(dt, 1);
    }
    return true;
  };

  const isSelectableCheckOut = (cell) => {
    if (cell.type !== 'day' || !checkIn) return false;
    if (cell.dateStr <= checkIn) return false;
    if (cell.isPast) return false;
    return isRangeFullyAvailable(checkIn, cell.dateStr);
  };

  const handleDateClick = (cell) => {
    if (cell.type !== 'day') return;
    setRangeError('');
    setSubmissionMessage('');
    setSubmissionType('');

    if (!checkIn) {
      if (isSelectableCheckIn(cell)) {
        setCheckIn(cell.dateStr);
        setCheckOut(null);
      }
      return;
    }

    if (!checkOut) {
      if (isSelectableCheckOut(cell)) {
        setCheckOut(cell.dateStr);
      } else {
        setRangeError('Selected range is not fully available.');
      }
      return;
    }

    if (cell.dateStr === checkIn || cell.dateStr === checkOut || inSelectedRange(cell.dateStr)) {
      setCheckIn(null);
      setCheckOut(null);
      setRangeError('');
    } else if (cell.dateStr < checkIn) {
      if (isSelectableCheckIn(cell)) {
        setCheckIn(cell.dateStr);
        setCheckOut(null);
      }
    } else if (checkOut && cell.dateStr > checkOut) {
      if (isSelectableCheckOut(cell)) {
        setCheckOut(cell.dateStr);
      } else {
        setRangeError('Cannot extend selection over unavailable dates.');
      }
    }
  };

  const resetSelection = () => {
    setCheckIn(null);
    setCheckOut(null);
    setRangeError('');
    setSubmissionMessage('');
    setSubmissionType('');
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    if (name === 'guest_count') {
      // Keep typed guest count constrained to 1-6 (same as spinner arrows).
      if (value === '') {
        nextValue = '';
      } else {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          nextValue = Math.min(6, Math.max(1, Math.trunc(parsed)));
        }
      }
    }

    setForm((prev) => ({ ...prev, [name]: nextValue }));
    if (name in fieldErrors && fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;

    // Admin block: minimal validation
    if (isAdmin) {
      setError('');
      setSubmissionMessage('');
      try {
        setSubmitting(true);
        const payload = {
          guest_name: 'admin',
          email: 'admin@example.com',
          phone: '0000000000',  // Default phone for admin blocks
          check_in: checkIn,
          check_out: checkOut,
          guest_count: 0,
          message: null,
          total_price: 0,
          special_requests: null,
          user_id: user ? user.id : null,
          is_admin_block: true
        };
        
        const response = await axios.post('/api/reservations', payload);
        
        // Show admin-specific success message immediately
        setSubmissionMessage('Dates successfully blocked! These dates are now unavailable for booking.');
        setSubmissionType('success');
        
        // Immediately refresh calendar availability to show blocked dates
        // Force reload by triggering the useEffect that loads availability
        setLoading(true);
        axios
          .get('/api/availability/calendar', { 
            params: { year, month },
            timeout: 10000
          })
          .then((res) => {
            const monthAvail = res.data.availability || [];
            setAvailability(monthAvail);
            
            // Update cache (dateStr -> is_available)
            setAvailabilityCache((prev) => {
              const next = { ...prev };
              for (const item of monthAvail) {
                const key = typeof item.date === 'string' ? item.date : formatDate(new Date(item.date));
                next[key] = Boolean(item.is_available);
              }
              return next;
            });
            
            setLoading(false);
          })
          .catch((err) => {
            console.error('Availability refresh error:', err);
            setLoading(false);
          });
        
        // Reset selection after a delay
        setTimeout(() => {
          resetSelection();
        }, 2000);
      } catch (e2) {
        let errorMsg = 'Failed to block dates.';
        if (e2.response && e2.response.data && e2.response.data.detail) {
          errorMsg = e2.response.data.detail;
        } else if (e2.message) {
          errorMsg = e2.message;
        }
        setSubmissionMessage(`Block Failed: ${errorMsg}`);
        setSubmissionType('error');
        console.error('Admin block submission error:', e2);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Regular reservation: full validation
    const nextErrors = { guest_name: '', email: '', phone: '', guest_count: '' };
    if (!form.guest_name.trim()) {
      nextErrors.guest_name = 'Please enter your name.';
    }
    // Only validate email if user is not logged in
    if (!user) {
      const emailOk = /.+@.+\..+/.test(form.email);
      if (!emailOk) {
        nextErrors.email = 'Please enter a valid email address.';
      }
    }
    if (!form.phone.trim()) {
      nextErrors.phone = 'Please enter your phone number.';
    }
    const guestsNum = Number(form.guest_count);
    if (!Number.isFinite(guestsNum) || guestsNum < 1 || guestsNum > 6) {
      nextErrors.guest_count = 'Guests must be between 1 and 6.';
    }

    // If any errors, show near fields and stop
    if (nextErrors.guest_name || nextErrors.email || nextErrors.phone || nextErrors.guest_count) {
      setFieldErrors(nextErrors);
      return;
    }

    setError('');
    setSubmissionMessage('');
    try {
      setSubmitting(true);
      const payload = {
        guest_name: form.guest_name,
        email: form.email,
        phone: form.phone,
        check_in: checkIn,
        check_out: checkOut,
        guest_count: guestsNum,
        message: form.message || null,
        total_price: totalPrice,
        special_requests: form.special_requests || null,
        user_id: user ? user.id : null,  // Link to user if logged in
        is_admin_block: false
      };
      
      const response = await axios.post('/api/reservations', payload);
      
      // Navigate to success page with booking details
      navigate('/booking-success', {
        state: {
          guest_name: form.guest_name,
          check_in: checkIn,
          check_out: checkOut,
          nights: diffNights(checkIn, checkOut),
          total_price: totalPrice,
          guest_count: guestsNum
        }
      });
    } catch (e2) {
      // More detailed error handling
      let errorMsg = 'Failed to submit reservation.';
      
      // Check if there's a detailed error from the backend
      if (e2.response && e2.response.data && e2.response.data.detail) {
        errorMsg = e2.response.data.detail;
      } else if (e2.message) {
        errorMsg = e2.message;
      }
      
      setSubmissionMessage(`Reservation Failed: ${errorMsg}`);
      setSubmissionType('error');
      
      // Log the full error for debugging
      console.error('Reservation submission error:', e2);
    } finally {
      setSubmitting(false);
    }
  };

  const goPrevMonth = () => {
    // Disallow navigating to months before the current month
    const curYM = year * 100 + month;
    const todayYM = today.getFullYear() * 100 + (today.getMonth() + 1);
    if (curYM <= todayYM) return; // already at current or earlier (should not happen with button disabled)

    setRangeError('');
    setSubmissionMessage('');
    setSubmissionType('');
    let y = year;
    let m = month - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    // Guard again after wrap
    const nextYM = y * 100 + m;
    if (nextYM < todayYM) return;
    setYear(y);
    setMonth(m);
  };

  const goNextMonth = () => {
    setRangeError('');
    setSubmissionMessage('');
    setSubmissionType('');
    let y = year;
    let m = month + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

  const prevDisabled = useMemo(() => {
    const curYM = year * 100 + month;
    const todayYM = today.getFullYear() * 100 + (today.getMonth() + 1);
    return curYM <= todayYM;
  }, [year, month]);

  return (
    <div className="book-page">
      <h2 className="book-title">Book Your Stay</h2>
      
      {/* Pricing Guide - Always Visible */}
      <div className="book-card book-pricing-guide">
        <div className="book-pricing-guide-head">
          <span className="book-pricing-guide-kicker">Pricing Guide</span>
        </div>
        <ul className="book-pricing-list book-pricing-list-main">
          <li>
            <span className="book-pricing-label">1-2 guests</span>
            <span className="book-pricing-value">500 ILS per night</span>
          </li>
          <li>
            <span className="book-pricing-label">Extra guests (up to 6)</span>
            <span className="book-pricing-value">+100 ILS per person</span>
          </li>
        </ul>
        <ul className="book-pricing-list book-pricing-list-extra">
          <li>
            <span className="book-pricing-label">Friday nights</span>
            <span className="book-pricing-value">+100 ILS</span>
          </li>
        </ul>
        <p className="book-pricing-payment"><strong>Payment:</strong> Cash upon arrival (no credit cards).</p>
      </div>

      <p className="book-subtitle">Select your check-in and check-out dates from the calendar.</p>

      {loading && <p className="book-status">Loading availability…</p>}
      {error && <p className="book-status book-status-error">{error}</p>}
      {rangeError && <p className="book-status book-status-error">{rangeError}</p>}

      {!loading && (
        <div className="book-calendar-wrap">
          <div className="book-calendar-header">
            <button className="book-month-btn" onClick={goPrevMonth} disabled={prevDisabled}>&lt;</button>
            <h3 className="book-calendar-month">
              {new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button className="book-month-btn" onClick={goNextMonth}>&gt;</button>
          </div>

          <div className="book-calendar-grid">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="book-weekday">{d}</div>
            ))}
            {calendarDays.map((cell) => {
              if (cell.type === 'blank') return <div key={cell.key} />;
              const selected = inSelectedRange(cell.dateStr) || cell.dateStr === checkIn || cell.dateStr === checkOut;

              const disabled = !checkIn ? !isSelectableCheckIn(cell) : !isSelectableCheckOut(cell);
              // Treat selectable checkout dates as available for styling,
              // even if that day itself is occupied (checkout morning is free).
              const styleAvailable = cell.isAvail || (!disabled && checkIn);
              const baseBg = styleAvailable ? '#ffffff' : '#f0f0f0';
              const bg = selected ? '#cdeffd' : (disabled ? '#f7f7f7' : baseBg);
              const color = disabled ? '#bbb' : (styleAvailable && !cell.isPast ? '#222' : '#999');
              const classes = [
                'book-day-cell',
                selected ? 'is-selected' : '',
                disabled ? 'is-disabled' : '',
                styleAvailable ? 'is-available' : 'is-unavailable',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={cell.dateStr}
                  onClick={() => handleDateClick(cell)}
                  disabled={disabled}
                  className={classes}
                  style={{ background: bg, color }}
                  title={cell.dateStr}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="book-selection-row">
            <strong>Selected:</strong>{' '}
            {checkIn ? formatDisplay(checkIn) : '—'} {checkOut ? '→ ' + formatDisplay(checkOut) : ''}
            {checkIn && checkOut && (
              <span className="book-selection-nights">
                ({diffNights(checkIn, checkOut)} night{diffNights(checkIn, checkOut) !== 1 ? 's' : ''})
              </span>
            )}
            {(checkIn || checkOut) && (
              <button className="book-clear-btn btn-secondary" onClick={resetSelection}>Clear</button>
            )}
          </div>
        </div>
      )}

      {checkIn && checkOut && (
        <form onSubmit={handleSubmit} noValidate className="book-form">
          <div className="book-form-grid">
            {isAdmin ? (
              // Admin view: simplified form - just submit button
              <>
                <div className="book-card book-admin-card">
                  <strong>Admin: Block Dates</strong>
                  <p className="book-admin-note">
                    Click submit to block these dates. They will be marked as occupied and unavailable for booking.
                  </p>
                </div>
                <div>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className={`book-submit-btn ${submitting ? 'is-submitting' : ''}`}
                  >
                    {submitting ? 'Blocking dates…' : 'Block These Dates'}
                  </button>
                  
                  {submissionMessage && (
                    <div className={`book-status book-submission ${submissionType === 'success' ? 'is-success' : 'is-error'}`}>
                      {submissionMessage}
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Regular user view: full form
              <>
                <label>
                  Name
                  <input
                    className="book-input"
                    type="text"
                    name="guest_name"
                    value={form.guest_name}
                    onChange={onFormChange}
                  />
                  {fieldErrors.guest_name && <div className="book-field-error">{fieldErrors.guest_name}</div>}
                </label>

                {!user && (
                  <label>
                    Email
                    <input
                      className="book-input"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={onFormChange}
                    />
                    {fieldErrors.email && <div className="book-field-error">{fieldErrors.email}</div>}
                  </label>
                )}

                <label>
                  Phone
                  <input
                    className="book-input"
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={onFormChange}
                  />
                  {fieldErrors.phone && <div className="book-field-error">{fieldErrors.phone}</div>}
                </label>

                <label>
                  Guests
                  <input
                    className="book-input"
                    type="number"
                    name="guest_count"
                    min={1}
                    max={6}
                    value={form.guest_count}
                    onChange={onFormChange}
                  />
                  {fieldErrors.guest_count && <div className="book-field-error">{fieldErrors.guest_count}</div>}
                </label>

                {/* Price display for specific reservation */}
                <div className="book-card book-reservation-pricing">
                  <strong className="book-pricing-title">Reservation Pricing</strong>
                  <p className="book-pricing-breakdown">
                    {diffNights(checkIn, checkOut)} night{diffNights(checkIn, checkOut) !== 1 ? 's' : ''} 
                    {' '}for {form.guest_count} guest{form.guest_count !== 1 ? 's' : ''}
                  </p>
                  <p className="book-pricing-total">
                    <strong>Total Cost: {totalPrice} ILS</strong>
                  </p>
                </div>

                {/* Simplified special requests */}
                <label>
                  Special Requests
                  <textarea
                    className="book-textarea"
                    name="special_requests"
                    rows={3}
                    value={form.special_requests}
                    onChange={onFormChange}
                    placeholder="Any special requests or additional information?"
                  />
                </label>

                <div>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className={`book-submit-btn ${submitting ? 'is-submitting' : ''}`}
                  >
                    {submitting ? 'Submitting…' : 'Submit request'}
                  </button>
                  
                  {/* Move submission message here, right after the submit button */}
                  {submissionMessage && (
                    <div className={`book-status book-submission ${submissionType === 'success' ? 'is-success' : 'is-error'}`}>
                      {submissionMessage}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
