import { useEffect, useState } from 'react';

function TestBackend() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        console.log('Response from /api/users:', res);
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => console.error('Error fetching users:', err));
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Mangos Users</h1>
      <ul>
        {users.map((user) => (
          <li key={user.user_id}>{user.username} (Created: {user.created_at})</li>
        ))}
      </ul>
    </div>
  );
}

export default TestBackend;