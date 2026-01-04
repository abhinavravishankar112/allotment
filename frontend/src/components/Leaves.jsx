import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Leaves({ doctors, apiUrl }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    doctor_id: '',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    loadLeaves();
  }, [currentDate]);

  const loadLeaves = async () => {
    try {
      const response = await axios.get(`${apiUrl}/leaves`, {
        params: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        }
      });
      setLeaves(response.data);
    } catch (error) {
      console.error('Error loading leaves:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${apiUrl}/leaves`, formData);
      setShowForm(false);
      setFormData({ doctor_id: '', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch (error) {
      console.error('Error creating leave:', error);
    }
  };

  const deleteLeave = async (id) => {
    if (window.confirm('Are you sure you want to delete this leave?')) {
      try {
        await axios.delete(`${apiUrl}/leaves/${id}`);
        loadLeaves();
      } catch (error) {
        console.error('Error deleting leave:', error);
      }
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const hasLeaveOnDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return leaves.some(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const check = new Date(dateStr);
      return check >= start && check <= end;
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="calendar-container">
      <div className="calendar card">
        <div className="calendar-header">
          <h2 className="card-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="calendar-nav">
            <button onClick={() => navigateMonth(-1)}>← Prev</button>
            <button onClick={() => setCurrentDate(new Date())}>Today</button>
            <button onClick={() => navigateMonth(1)}>Next →</button>
          </div>
        </div>

        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {days.map((day, index) => (
            <div 
              key={index}
              className={`calendar-day 
                ${!day.isCurrentMonth ? 'other-month' : ''} 
                ${isToday(day.date) ? 'today' : ''}
                ${hasLeaveOnDate(day.date) && day.isCurrentMonth ? 'has-leave' : ''}`}
              onClick={() => {
                if (day.isCurrentMonth) {
                  const dateStr = day.date.toISOString().split('T')[0];
                  setFormData(prev => ({ ...prev, start_date: dateStr, end_date: dateStr }));
                  setShowForm(true);
                }
              }}
            >
              {day.date.getDate()}
            </div>
          ))}
        </div>
      </div>

      <div className="leave-form card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
          {showForm ? 'Schedule Leave' : 'Upcoming Leaves'}
        </h3>

        {showForm ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Doctor</label>
              <select 
                value={formData.doctor_id}
                onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                required
              >
                <option value="">Select Doctor</option>
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Start Date</label>
              <input 
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input 
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Optional reason for leave"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Save Leave</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginBottom: '1rem' }}
              onClick={() => setShowForm(true)}
            >
              + Add Leave
            </button>

            <div className="leave-list">
              {leaves.length === 0 ? (
                <div className="empty-state">No leaves scheduled this month</div>
              ) : (
                leaves.map(leave => (
                  <div key={leave.id} className="leave-item">
                    <div className="leave-item-info">
                      <div className="leave-item-dates">
                        {leave.start_date} → {leave.end_date}
                      </div>
                      <div className="leave-item-doctor">{leave.doctor_name}</div>
                      {leave.reason && (
                        <div className="leave-item-reason">{leave.reason}</div>
                      )}
                    </div>
                    <button 
                      className="remove-btn"
                      onClick={() => deleteLeave(leave.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Leaves;
