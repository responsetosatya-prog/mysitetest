const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

// Test database connection
pool.connect((err) => {
  if (err) {
    console.log('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// ---------- MIDDLEWARE ----------
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin || false;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function verifyAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ---------- AUTH ROUTES ----------
// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Save user
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, isadmin',
      [name, email, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isadmin }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        isAdmin: user.isadmin 
      } 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.isblocked) return res.status(403).json({ error: 'Account is blocked' });
    
    // Check password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isadmin }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        isAdmin: user.isadmin 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- USER ROUTES ----------
// Add daily record
app.post('/api/daily-record', verifyToken, async (req, res) => {
  try {
    const { date, dailyCount, status, notes } = req.body;
    const userId = req.userId;
    
    // Check if record already exists for this date
    const existing = await pool.query(
      'SELECT * FROM daily_records WHERE userid = $1 AND date = $2',
      [userId, date]
    );
    
    if (existing.rows.length > 0) {
      // Update existing
      await pool.query(
        'UPDATE daily_records SET dailycount = $1, status = $2, notes = $3 WHERE userid = $4 AND date = $5',
        [dailyCount, status, notes, userId, date]
      );
      res.json({ message: 'Record updated!' });
    } else {
      // Insert new
      await pool.query(
        'INSERT INTO daily_records (userid, date, dailycount, status, notes) VALUES ($1, $2, $3, $4, $5)',
        [userId, date, dailyCount, status, notes]
      );
      res.json({ message: 'Record saved!' });
    }
  } catch (error) {
    console.error('Daily record error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's monthly records
app.get('/api/my-records/:month', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { month } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM daily_records 
       WHERE userid = $1 AND TO_CHAR(date, 'YYYY-MM') = $2 
       ORDER BY date DESC`,
      [userId, month]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's summary (total count for month)
app.get('/api/my-summary/:month', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { month } = req.params;
    
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(dailycount), 0) as total,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN status = 'holiday' THEN 1 END) as holiday
       FROM daily_records 
       WHERE userid = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [userId, month]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- ADMIN ROUTES ----------
// Get all users
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, isblocked, createdat 
       FROM users WHERE isadmin = false 
       ORDER BY createdat DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all daily records
app.get('/api/admin/all-records', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.name, u.email, d.date, d.dailycount, d.status, d.notes 
       FROM daily_records d 
       JOIN users u ON d.userid = u.id 
       WHERE u.isadmin = false
       ORDER BY d.date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin records error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get records for a specific user (admin)
app.get('/api/admin/user-records/:userId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT * FROM daily_records WHERE userid = $1 ORDER BY date DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin user records error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block/Unblock user
app.put('/api/admin/block-user/:userId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { block } = req.body;
    
    await pool.query('UPDATE users SET isblocked = $1 WHERE id = $2', [block, userId]);
    res.json({ message: `User ${block ? 'blocked' : 'unblocked'}` });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- CREATE ADMIN (One-time use) ----------
app.post('/api/create-admin', async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;
    
    // Change this to your own secret key!
    if (secretKey !== 'MY_SECRET_ADMIN_KEY_123') {
      return res.status(403).json({ error: 'Invalid secret key' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, isadmin) VALUES ($1, $2, $3, true)',
      [name, email, hashedPassword]
    );
    res.json({ message: 'Admin created successfully!' });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
