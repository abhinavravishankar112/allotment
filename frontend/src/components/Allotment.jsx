import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Allotment({ doctors, stations, apiUrl }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allotments, setAllotments] = useState([]);
  const [allowedStations, setAllowedStations] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllotments();
    loadAllowedStations();
  }, [selectedDate]);

  const loadAllotments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/allotments`, {
        params: { date: selectedDate }
      });
      setAllotments(response.data);
    } catch (error) {
      console.error('Error loading allotments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllowedStations = async () => {
    const allowed = {};
    for (const doctor of doctors) {
      try {
        const response = await axios.get(`${apiUrl}/doctors/${doctor.id}/allowed-stations`);
        allowed[doctor.id] = response.data;
      } catch (error) {
        console.error(`Error loading stations for doctor ${doctor.id}:`, error);
        allowed[doctor.id] = [];
      }
    }
    setAllowedStations(allowed);
  };

  const assignDoctor = async (stationId, doctorId) => {
    if (!doctorId) return;
    
    try {
      await axios.post(`${apiUrl}/allotments`, {
        doctor_id: parseInt(doctorId),
        station_id: stationId,
        date: selectedDate
      });
      loadAllotments();
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning doctor');
    }
  };

  const removeAllotment = async (allotmentId) => {
    try {
      await axios.delete(`${apiUrl}/allotments/${allotmentId}`);
      loadAllotments();
    } catch (error) {
      console.error('Error removing allotment:', error);
    }
  };

  const getStationAllotments = (stationId) => {
    return allotments.filter(a => a.station_id === stationId);
  };

  const getAvailableDoctors = (stationId) => {
    // Get doctors who are allowed at this station and not already assigned
    const assignedDoctorIds = allotments.map(a => a.doctor_id);
    
    return doctors.filter(doctor => {
      // Check if already assigned
      if (assignedDoctorIds.includes(doctor.id)) return false;
      
      // Check if allowed at this station
      const allowed = allowedStations[doctor.id] || [];
      return allowed.some(s => s.id === stationId);
    });
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Station Allotment</h2>
          <div className="date-picker">
            <input 
              type="date" 
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <strong>ℹ️ Note:</strong> Only doctors who are eligible for each station are shown in the dropdown. 
          Eligibility is based on their role permissions and individual restrictions.
        </div>

        {loading ? (
          <div className="loading">Loading allotments...</div>
        ) : (
          <div className="allotment-grid">
            {stations.map(station => {
              const stationAllotments = getStationAllotments(station.id);
              const availableDoctors = getAvailableDoctors(station.id);
              
              return (
                <div key={station.id} className="station-card">
                  <div className="station-header">
                    <span className="station-name">{station.name}</span>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>
                      {stationAllotments.length} assigned
                    </span>
                  </div>
                  
                  <div className="assigned-doctors">
                    {stationAllotments.map(allotment => (
                      <div key={allotment.id} className="assigned-doctor">
                        <div>
                          <div style={{ fontWeight: 500 }}>{allotment.doctor_name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>{allotment.role_name}</div>
                        </div>
                        <button 
                          className="remove-btn"
                          onClick={() => removeAllotment(allotment.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {stationAllotments.length === 0 && (
                      <div style={{ color: '#999', fontSize: '0.9rem', padding: '0.5rem' }}>
                        No doctors assigned
                      </div>
                    )}
                  </div>

                  <select 
                    className="add-doctor-select"
                    value=""
                    onChange={(e) => assignDoctor(station.id, e.target.value)}
                  >
                    <option value="">+ Assign a doctor</option>
                    {availableDoctors.map(doctor => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name} ({doctor.role_name})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Station Restrictions Summary</h3>
        <div style={{ fontSize: '0.9rem' }}>
          {doctors.filter(d => d.restrictions && d.restrictions.length > 0).map(doctor => (
            <div key={doctor.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{doctor.name}</strong>
              <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>
                Cannot go to: {doctor.restrictions.map(r => r.name).join(', ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Allotment;
