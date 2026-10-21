const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 2. Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3. Routes
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, created_at FROM users',
    );
    console.log('Fetched users:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Database Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// 4. Start Server (This keeps the app running alive)
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running and listening on port ${PORT}`);
});