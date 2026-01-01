const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'allotment.db');
let db = null;

async function initialize() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);

  // Create stations table
  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Create doctors table
  db.run(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_id INTEGER,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Create doctor_station_restrictions table (stations a doctor CANNOT go to)
  db.run(`
    CREATE TABLE IF NOT EXISTS doctor_station_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      UNIQUE(doctor_id, station_id)
    )
  `);

  // Create role_station_permissions table (stations a role CAN go to)
  db.run(`
    CREATE TABLE IF NOT EXISTS role_station_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      UNIQUE(role_id, station_id)
    )
  `);

  // Create attendance table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'leave')),
      notes TEXT,
      marked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      UNIQUE(doctor_id, date)
    )
  `);

  // Create leaves table (for advanced leave scheduling)
  db.run(`
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);

  // Create allotments table
  db.run(`
    CREATE TABLE IF NOT EXISTS allotments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      shift TEXT DEFAULT 'day',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      UNIQUE(doctor_id, date, shift)
    )
  `);

  // Seed initial data if tables are empty
  seedData();
  saveDatabase();
  
  console.log('Database initialized successfully');
}

function seedData() {
  // Check if we have any roles
  const result = db.exec('SELECT COUNT(*) as count FROM roles');
  const roleCount = result.length > 0 ? result[0].values[0][0] : 0;
  
  if (roleCount === 0) {
    // Insert default roles
    const roles = [
      { name: 'Senior Consultant', description: 'Senior level doctor with all station access' },
      { name: 'Consultant', description: 'Regular consultant with standard access' },
      { name: 'Junior Resident', description: 'Junior level with limited station access' },
      { name: 'Senior Resident', description: 'Senior resident with extended access' }
    ];
    
    roles.forEach(role => {
      db.run('INSERT INTO roles (name, description) VALUES (?, ?)', [role.name, role.description]);
    });

    // Insert 7 stations
    const stations = [
      { name: 'Emergency', description: 'Emergency Department' },
      { name: 'ICU', description: 'Intensive Care Unit' },
      { name: 'OPD', description: 'Out Patient Department' },
      { name: 'Surgery', description: 'Surgery Department' },
      { name: 'Pediatrics', description: 'Pediatrics Department' },
      { name: 'Radiology', description: 'Radiology Department' },
      { name: 'Laboratory', description: 'Laboratory Department' }
    ];
    
    stations.forEach(station => {
      db.run('INSERT INTO stations (name, description) VALUES (?, ?)', [station.name, station.description]);
    });

    // Insert 13 doctors
    const doctors = [
      { name: 'Dr. Sharma', role_id: 1 },
      { name: 'Dr. Patel', role_id: 1 },
      { name: 'Dr. Kumar', role_id: 2 },
      { name: 'Dr. Singh', role_id: 2 },
      { name: 'Dr. Gupta', role_id: 2 },
      { name: 'Dr. Reddy', role_id: 3 },
      { name: 'Dr. Joshi', role_id: 3 },
      { name: 'Dr. Verma', role_id: 3 },
      { name: 'Dr. Rao', role_id: 4 },
      { name: 'Dr. Mishra', role_id: 4 },
      { name: 'Dr. Nair', role_id: 2 },
      { name: 'Dr. Iyer', role_id: 3 },
      { name: 'Dr. Menon', role_id: 4 }
    ];
    
    doctors.forEach(doctor => {
      db.run('INSERT INTO doctors (name, role_id) VALUES (?, ?)', [doctor.name, doctor.role_id]);
    });

    // Add restrictions - 5 doctors cannot go to ICU (station_id 2)
    const restrictions = [
      { doctor_id: 6, station_id: 2 },  // Dr. Reddy
      { doctor_id: 7, station_id: 2 },  // Dr. Joshi
      { doctor_id: 8, station_id: 2 },  // Dr. Verma
      { doctor_id: 12, station_id: 2 }, // Dr. Iyer
      { doctor_id: 13, station_id: 2 }  // Dr. Menon
    ];
    
    restrictions.forEach(r => {
      db.run('INSERT INTO doctor_station_restrictions (doctor_id, station_id) VALUES (?, ?)', [r.doctor_id, r.station_id]);
    });

    // Set role-station permissions
    const allRolesResult = db.exec('SELECT id FROM roles');
    const allStationsResult = db.exec('SELECT id FROM stations');
    
    if (allRolesResult.length > 0 && allStationsResult.length > 0) {
      const allRoles = allRolesResult[0].values.map(v => ({ id: v[0] }));
      const allStations = allStationsResult[0].values.map(v => ({ id: v[0] }));
      
      allRoles.forEach(role => {
        allStations.forEach(station => {
          // Junior Residents (role_id 3) cannot access Surgery (station_id 4)
          if (role.id === 3 && station.id === 4) return;
          db.run('INSERT INTO role_station_permissions (role_id, station_id) VALUES (?, ?)', [role.id, station.id]);
        });
      });
    }

    console.log('Seed data inserted successfully');
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb() {
  return db;
}

// Helper functions to convert sql.js results to objects
function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0],
    changes: db.getRowsModified()
  };
}

module.exports = {
  initialize,
  getDb,
  saveDatabase,
  queryAll,
  queryOne,
  runQuery
};
