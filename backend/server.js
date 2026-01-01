const express = require('express');
const cors = require('cors');
const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database and start server
async function start() {
  await db.initialize();
  
  // API routes
  app.use('/api', routes);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);
