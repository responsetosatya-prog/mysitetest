import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';

// API URL - Change this when deployed
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ---------- LOGIN PAGE ----------
function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/login`, { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      if (response.data.user.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '400px', margin: '50px auto' }}>
        <h2>Login</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Login</button>
        </form>
        <p style={{ marginTop: '15px' }}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

// ---------- SIGNUP PAGE ----------
function Signup({ setUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/signup`, { name, email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      navigate('/dashboard');
    } catch (error) {
      setError(error.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '400px', margin: '50px auto' }}>
        <h2>Sign Up</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button type="submit">Sign Up</button>
        </form>
        <p style={{ marginTop: '15px' }}>
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

// ---------- USER DASHBOARD ----------
function UserDashboard() {
  const [dailyCount, setDailyCount] = useState('');
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, holiday: 0 });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  const fetchRecords = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/my-records/${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMonthlyRecords(response.data);
      
      const summaryRes = await axios.get(`${API_URL}/api/my-summary/${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const today = new Date().toISOString().slice(0, 10);
      await axios.post(`${API_URL}/api/daily-record`, 
        { date: today, dailyCount: parseInt(dailyCount), status, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('✅ Record saved successfully!');
      setDailyCount('');
      setNotes('');
      fetchRecords();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error saving record');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>📊 Daily Entry</h2>
        {message && <p style={{ color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}
        <form onSubmit={handleSubmit}>
          <input type="number" placeholder="Daily Count" value={dailyCount} onChange={(e) => setDailyCount(e.target.value)} required />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="present">✅ Present</option>
            <option value="absent">❌ Absent</option>
            <option value="holiday">🎉 Holiday</option>
          </select>
          <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" />
          <button type="submit">Save Today's Record</button>
        </form>
      </div>

      <div className="card">
        <h2>📈 Monthly Summary - {selectedMonth}</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div><strong>Total:</strong> {summary.total}</div>
          <div><strong>Present:</strong> {summary.present} days</div>
          <div><strong>Absent:</strong> {summary.absent} days</div>
          <div><strong>Holiday:</strong> {summary.holiday} days</div>
        </div>
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div className="card">
        <h2>📋 Records</h2>
        {monthlyRecords.length === 0 ? (
          <p>No records for this month</p>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Count</th><th>Status</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {monthlyRecords.map(record => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.dailycount}</td>
                  <td>{record.status}</td>
                  <td>{record.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- ADMIN DASHBOARD ----------
function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  const fetchAllData = async () => {
    try {
      const usersRes = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(usersRes.data);

      const recordsRes = await axios.get(`${API_URL}/api/admin/all-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllRecords(recordsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const toggleBlock = async (userId, currentBlockStatus) => {
    try {
      await axios.put(`${API_URL}/api/admin/block-user/${userId}`,
        { block: !currentBlockStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`✅ User ${!currentBlockStatus ? 'blocked' : 'unblocked'}`);
      fetchAllData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error updating user');
    }
  };

  const exportCSV = () => {
    let csv = 'User,Email,Date,Count,Status,Notes\n';
    allRecords.forEach(r => {
      csv += `"${r.name}","${r.email}","${r.date}",${r.dailycount},"${r.status}","${r.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>🔐 Admin Dashboard</h2>
        {message && <p style={{ color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}
        <button onClick={exportCSV}>📥 Export All Data</button>
      </div>

      <div className="card">
        <h2>👥 Users ({users.length})</h2>
        {users.length === 0 ? (
          <p>No users registered yet</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Joined</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{new Date(user.createdat).toLocaleDateString()}</td>
                  <td>{user.isblocked ? '🚫 Blocked' : '✅ Active'}</td>
                  <td>
                    <button className={user.isblocked ? '' : 'danger'} onClick={() => toggleBlock(user.id, user.isblocked)}>
                      {user.isblocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>📋 All User Activity ({allRecords.length} records)</h2>
        {allRecords.length === 0 ? (
          <p>No activity records yet</p>
        ) : (
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Date</th><th>Count</th><th>Status</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {allRecords.map((record, index) => (
                <tr key={index}>
                  <td>{record.name}</td>
                  <td>{record.email}</td>
                  <td>{record.date}</td>
                  <td>{record.dailycount}</td>
                  <td>{record.status}</td>
                  <td>{record.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- PROTECTED ROUTE ----------
function ProtectedRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  if (!token) return <Navigate to="/" />;
  if (adminOnly && !user?.isAdmin) return <Navigate to="/dashboard" />;
  return children;
}

// ---------- NAVBAR ----------
function Navbar({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div>
        <strong>MySiteTest</strong>
        {user.isAdmin ? (
          <Link to="/admin">Admin Panel</Link>
        ) : (
          <Link to="/dashboard">Dashboard</Link>
        )}
      </div>
      <div>
        <span style={{ marginRight: '15px' }}>👋 {user.name}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

// ---------- MAIN APP ----------
function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <BrowserRouter>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<Login setUser={setUser} />} />
        <Route path="/signup" element={<Signup setUser={setUser} />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
