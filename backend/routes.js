const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runQuery, saveDatabase } = require('./database');

// ============== DOCTORS ==============

// Get all doctors with their roles and restrictions
router.get('/doctors', (req, res) => {
  try {
    const doctors = queryAll(`
      SELECT d.*, r.name as role_name, r.description as role_description
      FROM doctors d
      LEFT JOIN roles r ON d.role_id = r.id
      WHERE d.is_active = 1
      ORDER BY d.name
    `);

    // Get restrictions for each doctor
    const restrictions = queryAll(`
      SELECT dsr.doctor_id, s.id as station_id, s.name as station_name
      FROM doctor_station_restrictions dsr
      JOIN stations s ON dsr.station_id = s.id
    `);

    const restrictionMap = {};
    restrictions.forEach(r => {
      if (!restrictionMap[r.doctor_id]) restrictionMap[r.doctor_id] = [];
      restrictionMap[r.doctor_id].push({ id: r.station_id, name: r.station_name });
    });

    const result = doctors.map(d => ({
      ...d,
      restrictions: restrictionMap[d.id] || []
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single doctor
router.get('/doctors/:id', (req, res) => {
  try {
    const doctor = queryOne(`
      SELECT d.*, r.name as role_name
      FROM doctors d
      LEFT JOIN roles r ON d.role_id = r.id
      WHERE d.id = ?
    `, [req.params.id]);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const restrictions = queryAll(`
      SELECT s.id, s.name
      FROM doctor_station_restrictions dsr
      JOIN stations s ON dsr.station_id = s.id
      WHERE dsr.doctor_id = ?
    `, [req.params.id]);

    res.json({ ...doctor, restrictions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create doctor
router.post('/doctors', (req, res) => {
  try {
    const { name, role_id, restrictions = [] } = req.body;
    const result = runQuery('INSERT INTO doctors (name, role_id) VALUES (?, ?)', [name, role_id]);
    
    if (restrictions.length > 0) {
      restrictions.forEach(stationId => {
        runQuery('INSERT INTO doctor_station_restrictions (doctor_id, station_id) VALUES (?, ?)', [result.lastInsertRowid, stationId]);
      });
    }
    
    res.json({ id: result.lastInsertRowid, name, role_id, restrictions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update doctor
router.put('/doctors/:id', (req, res) => {
  try {
    const { name, role_id, restrictions = [] } = req.body;
    runQuery('UPDATE doctors SET name = ?, role_id = ? WHERE id = ?', [name, role_id, req.params.id]);
    
    // Update restrictions
    runQuery('DELETE FROM doctor_station_restrictions WHERE doctor_id = ?', [req.params.id]);
    if (restrictions.length > 0) {
      restrictions.forEach(stationId => {
        runQuery('INSERT INTO doctor_station_restrictions (doctor_id, station_id) VALUES (?, ?)', [req.params.id, stationId]);
      });
    }
    
    res.json({ id: req.params.id, name, role_id, restrictions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== STATIONS ==============

router.get('/stations', (req, res) => {
  try {
    const stations = queryAll('SELECT * FROM stations WHERE is_active = 1 ORDER BY name');
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== ROLES ==============

router.get('/roles', (req, res) => {
  try {
    const roles = queryAll('SELECT * FROM roles ORDER BY name');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stations allowed for a role
router.get('/roles/:id/stations', (req, res) => {
  try {
    const stations = queryAll(`
      SELECT s.*
      FROM role_station_permissions rsp
      JOIN stations s ON rsp.station_id = s.id
      WHERE rsp.role_id = ? AND s.is_active = 1
    `, [req.params.id]);
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== ATTENDANCE ==============

// Get attendance for a date
router.get('/attendance', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get all active doctors
    const doctors = queryAll(`
      SELECT d.*, r.name as role_name
      FROM doctors d
      LEFT JOIN roles r ON d.role_id = r.id
      WHERE d.is_active = 1
      ORDER BY d.name
    `);

    // Get attendance for the date
    const attendance = queryAll(`SELECT * FROM attendance WHERE date = ?`, [date]);

    const attendanceMap = {};
    attendance.forEach(a => {
      attendanceMap[a.doctor_id] = a;
    });

    // Check for approved leaves on this date
    const leaves = queryAll(`
      SELECT * FROM leaves 
      WHERE status = 'approved' 
      AND date(?) BETWEEN date(start_date) AND date(end_date)
    `, [date]);

    const leaveMap = {};
    leaves.forEach(l => {
      leaveMap[l.doctor_id] = l;
    });

    // Get restrictions for each doctor
    const restrictions = queryAll(`
      SELECT dsr.doctor_id, s.id as station_id, s.name as station_name
      FROM doctor_station_restrictions dsr
      JOIN stations s ON dsr.station_id = s.id
    `);

    const restrictionMap = {};
    restrictions.forEach(r => {
      if (!restrictionMap[r.doctor_id]) restrictionMap[r.doctor_id] = [];
      restrictionMap[r.doctor_id].push({ id: r.station_id, name: r.station_name });
    });

    const result = doctors.map(d => ({
      ...d,
      attendance: attendanceMap[d.id] || null,
      has_leave: !!leaveMap[d.id],
      leave: leaveMap[d.id] || null,
      restrictions: restrictionMap[d.id] || []
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark attendance
router.post('/attendance', (req, res) => {
  try {
    const { doctor_id, date, status, notes } = req.body;
    
    const existing = queryOne('SELECT * FROM attendance WHERE doctor_id = ? AND date = ?', [doctor_id, date]);
    
    if (existing) {
      runQuery('UPDATE attendance SET status = ?, notes = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?', [status, notes, existing.id]);
      res.json({ ...existing, status, notes });
    } else {
      const result = runQuery('INSERT INTO attendance (doctor_id, date, status, notes) VALUES (?, ?, ?, ?)', [doctor_id, date, status, notes]);
      res.json({ id: result.lastInsertRowid, doctor_id, date, status, notes });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update attendance
router.post('/attendance/bulk', (req, res) => {
  try {
    const { date, attendance } = req.body;
    
    for (const record of attendance) {
      const existing = queryOne('SELECT * FROM attendance WHERE doctor_id = ? AND date = ?', [record.doctor_id, date]);
      
      if (existing) {
        runQuery('UPDATE attendance SET status = ?, notes = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?', 
          [record.status, record.notes || null, existing.id]);
      } else {
        runQuery('INSERT INTO attendance (doctor_id, date, status, notes) VALUES (?, ?, ?, ?)', 
          [record.doctor_id, date, record.status, record.notes || null]);
      }
    }
    
    saveDatabase();
    res.json({ success: true, count: attendance.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== LEAVES ==============

// Get all leaves
router.get('/leaves', (req, res) => {
  try {
    const { doctor_id, month, year } = req.query;
    
    let sql = `
      SELECT l.*, d.name as doctor_name
      FROM leaves l
      JOIN doctors d ON l.doctor_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (doctor_id) {
      sql += ' AND l.doctor_id = ?';
      params.push(doctor_id);
    }

    if (month && year) {
      const paddedMonth = month.toString().padStart(2, '0');
      sql += ` AND (
        (strftime('%m', l.start_date) = ? AND strftime('%Y', l.start_date) = ?)
        OR (strftime('%m', l.end_date) = ? AND strftime('%Y', l.end_date) = ?)
      )`;
      params.push(paddedMonth, year, paddedMonth, year);
    }

    sql += ' ORDER BY l.start_date DESC';
    
    const leaves = queryAll(sql, params);
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create leave
router.post('/leaves', (req, res) => {
  try {
    const { doctor_id, start_date, end_date, reason, status = 'approved' } = req.body;
    
    const result = runQuery(
      'INSERT INTO leaves (doctor_id, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?)',
      [doctor_id, start_date, end_date, reason, status]
    );
    
    res.json({ id: result.lastInsertRowid, doctor_id, start_date, end_date, reason, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update leave
router.put('/leaves/:id', (req, res) => {
  try {
    const { start_date, end_date, reason, status } = req.body;
    
    runQuery('UPDATE leaves SET start_date = ?, end_date = ?, reason = ?, status = ? WHERE id = ?',
      [start_date, end_date, reason, status, req.params.id]);
    
    res.json({ id: req.params.id, start_date, end_date, reason, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete leave
router.delete('/leaves/:id', (req, res) => {
  try {
    runQuery('DELETE FROM leaves WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== ALLOTMENTS ==============

// Get allotments for a date range
router.get('/allotments', (req, res) => {
  try {
    const { date, start_date, end_date } = req.query;
    
    let sql = `
      SELECT a.*, d.name as doctor_name, s.name as station_name, r.name as role_name
      FROM allotments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN stations s ON a.station_id = s.id
      LEFT JOIN roles r ON d.role_id = r.id
    `;
    const params = [];

    if (date) {
      sql += ' WHERE a.date = ?';
      params.push(date);
    } else if (start_date && end_date) {
      sql += ' WHERE a.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    sql += ' ORDER BY a.date, s.name';
    
    const allotments = queryAll(sql, params);
    res.json(allotments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get allowed stations for a doctor (considering role permissions and individual restrictions)
router.get('/doctors/:id/allowed-stations', (req, res) => {
  try {
    const doctor = queryOne('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Get stations allowed by role
    const roleStations = queryAll(`
      SELECT s.*
      FROM role_station_permissions rsp
      JOIN stations s ON rsp.station_id = s.id
      WHERE rsp.role_id = ? AND s.is_active = 1
    `, [doctor.role_id]);

    // Get individual restrictions
    const restrictions = queryAll(`
      SELECT station_id FROM doctor_station_restrictions WHERE doctor_id = ?
    `, [req.params.id]);
    
    const restrictedIds = new Set(restrictions.map(r => r.station_id));

    // Filter out restricted stations
    const allowedStations = roleStations.filter(s => !restrictedIds.has(s.id));
    
    res.json(allowedStations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create allotment
router.post('/allotments', (req, res) => {
  try {
    const { doctor_id, station_id, date, shift = 'day', notes } = req.body;

    // Validate that doctor can be assigned to this station
    const doctor = queryOne('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    
    // Check role permission
    const rolePermission = queryOne(`
      SELECT * FROM role_station_permissions WHERE role_id = ? AND station_id = ?
    `, [doctor.role_id, station_id]);
    
    if (!rolePermission) {
      return res.status(400).json({ error: 'Doctor\'s role does not allow this station' });
    }

    // Check individual restriction
    const restriction = queryOne(`
      SELECT * FROM doctor_station_restrictions WHERE doctor_id = ? AND station_id = ?
    `, [doctor_id, station_id]);
    
    if (restriction) {
      return res.status(400).json({ error: 'Doctor has a restriction for this station' });
    }

    // Check if already assigned for this date/shift
    const existing = queryOne('SELECT * FROM allotments WHERE doctor_id = ? AND date = ? AND shift = ?', [doctor_id, date, shift]);
    if (existing) {
      return res.status(400).json({ error: 'Doctor already has an allotment for this date and shift' });
    }

    const result = runQuery(
      'INSERT INTO allotments (doctor_id, station_id, date, shift, notes) VALUES (?, ?, ?, ?, ?)',
      [doctor_id, station_id, date, shift, notes]
    );
    
    res.json({ id: result.lastInsertRowid, doctor_id, station_id, date, shift, notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update allotment
router.put('/allotments/:id', (req, res) => {
  try {
    const { doctor_id, station_id, date, shift, notes } = req.body;
    
    // Same validation as create
    const doctor = queryOne('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    
    const rolePermission = queryOne(`
      SELECT * FROM role_station_permissions WHERE role_id = ? AND station_id = ?
    `, [doctor.role_id, station_id]);
    
    if (!rolePermission) {
      return res.status(400).json({ error: 'Doctor\'s role does not allow this station' });
    }

    const restriction = queryOne(`
      SELECT * FROM doctor_station_restrictions WHERE doctor_id = ? AND station_id = ?
    `, [doctor_id, station_id]);
    
    if (restriction) {
      return res.status(400).json({ error: 'Doctor has a restriction for this station' });
    }

    runQuery('UPDATE allotments SET doctor_id = ?, station_id = ?, date = ?, shift = ?, notes = ? WHERE id = ?',
      [doctor_id, station_id, date, shift, notes, req.params.id]);
    
    res.json({ id: req.params.id, doctor_id, station_id, date, shift, notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete allotment
router.delete('/allotments/:id', (req, res) => {
  try {
    runQuery('DELETE FROM allotments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
