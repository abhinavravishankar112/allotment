import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Attendance({ doctors, apiUrl }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/attendance`, {
        params: { date: selectedDate }
      });
      setAttendanceData(response.data);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (doctorId, status) => {
    try {
      await axios.post(`${apiUrl}/attendance`, {
        doctor_id: doctorId,
        date: selectedDate,
        status: status
      });
      
      setAttendanceData(prev => prev.map(d => 
        d.id === doctorId 
          ? { ...d, attendance: { ...d.attendance, status } }
          : d
      ));
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const markAllPresent = async () => {
    setSaving(true);
    try {
      const attendance = attendanceData
        .filter(d => !d.has_leave)
        .map(d => ({
          doctor_id: d.id,
          status: 'present'
        }));
      
      await axios.post(`${apiUrl}/attendance/bulk`, {
        date: selectedDate,
        attendance
      });
      
      loadAttendance();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStats = () => {
    const present = attendanceData.filter(d => d.attendance?.status === 'present').length;
    const absent = attendanceData.filter(d => d.attendance?.status === 'absent').length;
    const onLeave = attendanceData.filter(d => d.has_leave || d.attendance?.status === 'leave').length;
    const unmarked = attendanceData.filter(d => !d.attendance && !d.has_leave).length;
    
    return { present, absent, onLeave, unmarked, total: attendanceData.length };
  };

  const stats = getStats();

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Doctors</div>
        </div>
        <div className="stat-card present">
          <div className="stat-value">{stats.present}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card absent">
          <div className="stat-value">{stats.absent}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-card leave">
          <div className="stat-value">{stats.onLeave}</div>
          <div className="stat-label">On Leave</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Daily Attendance</h2>
          <div className="date-picker">
            <input 
              type="date" 
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button 
              className="btn btn-primary" 
              onClick={markAllPresent}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Mark All Present'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading attendance...</div>
        ) : (
          <div className="doctor-list">
            {attendanceData.map(doctor => (
              <div key={doctor.id} className="doctor-item">
                <div className="doctor-info">
                  <div className="doctor-name">{doctor.name}</div>
                  <div className="doctor-role">{doctor.role_name}</div>
                  {doctor.restrictions && doctor.restrictions.length > 0 && (
                    <div className="doctor-restrictions">
                      ⚠️ Cannot go to: {doctor.restrictions.map(r => r.name).join(', ')}
                    </div>
                  )}
                </div>
                
                {doctor.has_leave && (
                  <span className="leave-badge">
                    📅 On Leave: {doctor.leave?.reason || 'Scheduled'}
                  </span>
                )}
                
                <div className="attendance-btns">
                  <button 
                    className={`attendance-btn ${doctor.attendance?.status === 'present' ? 'present' : ''}`}
                    onClick={() => markAttendance(doctor.id, 'present')}
                    disabled={doctor.has_leave}
                  >
                    Present
                  </button>
                  <button 
                    className={`attendance-btn ${doctor.attendance?.status === 'absent' ? 'absent' : ''}`}
                    onClick={() => markAttendance(doctor.id, 'absent')}
                    disabled={doctor.has_leave}
                  >
                    Absent
                  </button>
                  <button 
                    className={`attendance-btn ${doctor.attendance?.status === 'leave' ? 'leave' : ''}`}
                    onClick={() => markAttendance(doctor.id, 'leave')}
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Attendance;
