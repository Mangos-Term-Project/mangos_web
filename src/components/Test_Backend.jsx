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