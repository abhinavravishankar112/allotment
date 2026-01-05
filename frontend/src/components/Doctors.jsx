import React, { useState } from 'react';
import axios from 'axios';

function Doctors({ doctors, stations, roles, apiUrl, onUpdate }) {
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role_id: '',
    restrictions: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await axios.put(`${apiUrl}/doctors/${editingDoctor.id}`, formData);
      } else {
        await axios.post(`${apiUrl}/doctors`, formData);
      }
      setShowAddForm(false);
      setEditingDoctor(null);
      setFormData({ name: '', role_id: '', restrictions: [] });
      onUpdate();
    } catch (error) {
      console.error('Error saving doctor:', error);
    }
  };

  const startEdit = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      role_id: doctor.role_id,
      restrictions: doctor.restrictions?.map(r => r.id) || []
    });
    setShowAddForm(true);
  };

  const toggleRestriction = (stationId) => {
    setFormData(prev => ({
      ...prev,
      restrictions: prev.restrictions.includes(stationId)
        ? prev.restrictions.filter(id => id !== stationId)
        : [...prev.restrictions, stationId]
    }));
  };

  const getRoleColor = (roleId) => {
    const colors = {
      1: '#27ae60', // Senior Consultant - green
      2: '#3498db', // Consultant - blue
      3: '#f39c12', // Junior Resident - orange
      4: '#9b59b6'  // Senior Resident - purple
    };
    return colors[roleId] || '#667eea';
  };

  return (
    <div>
      {showAddForm && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Dr. Smith"
                required
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: parseInt(e.target.value) })}
                required
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Station Restrictions (stations this doctor CANNOT go to)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {stations.map(station => (
                  <label 
                    key={station.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      padding: '0.5rem 0.75rem',
                      background: formData.restrictions.includes(station.id) ? '#fee2e2' : '#f8f9fa',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: formData.restrictions.includes(station.id) ? '1px solid #dc2626' : '1px solid #ddd'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.restrictions.includes(station.id)}
                      onChange={() => toggleRestriction(station.id)}
                    />
                    {station.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingDoctor(null);
                  setFormData({ name: '', role_id: '', restrictions: [] });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Doctors ({doctors.length})</h2>
          {!showAddForm && (
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              + Add Doctor
            </button>
          )}
        </div>

        <div className="doctors-grid">
          {doctors.map(doctor => (
            <div key={doctor.id} className="doctor-card">
              <div className="doctor-card-header">
                <span className="doctor-card-name">{doctor.name}</span>
                <button 
                  className="btn" 
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => startEdit(doctor)}
                >
                  Edit
                </button>
              </div>
              
              <span 
                className="role-badge" 
                style={{ backgroundColor: `${getRoleColor(doctor.role_id)}20`, color: getRoleColor(doctor.role_id) }}
              >
                {doctor.role_name}
              </span>

              {doctor.restrictions && doctor.restrictions.length > 0 && (
                <div className="restriction-list">
                  <div className="restriction-label">⚠️ Station Restrictions:</div>
                  <div className="restriction-tags">
                    {doctor.restrictions.map(restriction => (
                      <span key={restriction.id} className="restriction-tag">
                        {restriction.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Role Definitions</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {roles.map(role => (
            <div key={role.id} style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{role.name}</div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>{role.description}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#888' }}>
          Note: Junior Residents cannot access the Surgery station by default (role-level restriction).
        </p>
      </div>
    </div>
  );
}

export default Doctors;
