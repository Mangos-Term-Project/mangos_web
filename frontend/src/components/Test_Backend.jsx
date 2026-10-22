import { useEffect, useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function TestBackend() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/users`)
      .then((res) => {
        console.log('Response from /api/users:', res);
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => console.error('Error fetching users:', err));
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h3>Testing API Call (Remove later)</h3>
      <ul>
        {users.map((user) => (
          <li key={user.user_id}>{user.username} (Created: {user.created_at})</li>
        ))}
      </ul>
    </div>
  );
}

export default TestBackend;