import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Attendance from './components/Attendance.jsx';
import Leaves from './components/Leaves.jsx';
import Allotment from './components/Allotment.jsx';
import Doctors from './components/Doctors.jsx';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [doctors, setDoctors] = useState([]);
  const [stations, setStations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [doctorsRes, stationsRes, rolesRes] = await Promise.all([
        axios.get(`${API_URL}/doctors`),
        axios.get(`${API_URL}/stations`),
        axios.get(`${API_URL}/roles`)
      ]);
      setDoctors(doctorsRes.data);
      setStations(stationsRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="loading">Loading...</div>;
    }

    switch (activeTab) {
      case 'attendance':
        return <Attendance doctors={doctors} apiUrl={API_URL} />;
      case 'leaves':
        return <Leaves doctors={doctors} apiUrl={API_URL} />;
      case 'allotment':
        return <Allotment doctors={doctors} stations={stations} apiUrl={API_URL} />;
      case 'doctors':
        return <Doctors doctors={doctors} stations={stations} roles={roles} apiUrl={API_URL} onUpdate={loadInitialData} />;
      default:
        return <Attendance doctors={doctors} apiUrl={API_URL} />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🏥 Allotment Manager</h1>
      </header>
      
      <nav className="nav">
        <button 
          className={`nav-btn ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          📋 Attendance
        </button>
        <button 
          className={`nav-btn ${activeTab === 'leaves' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaves')}
        >
          📅 Leaves Calendar
        </button>
        <button 
          className={`nav-btn ${activeTab === 'allotment' ? 'active' : ''}`}
          onClick={() => setActiveTab('allotment')}
        >
          🔄 Allotment
        </button>
        <button 
          className={`nav-btn ${activeTab === 'doctors' ? 'active' : ''}`}
          onClick={() => setActiveTab('doctors')}
        >
          👨‍⚕️ Doctors
        </button>
      </nav>

      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
