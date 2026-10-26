const GENERIC_ERROR = 'Something went wrong. Please try again.'

async function request(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const serverMessage = typeof data?.detail === 'string' ? data.detail : ''
    const error = new Error(response.status < 500 && serverMessage ? serverMessage : GENERIC_ERROR)
    error.status = response.status
    throw error
  }

  return data
}

export function register({ name, username, password }) {
  return request('/api/auth/register', { method: 'POST', body: { name, username, password } })
}

export function login({ username, password }) {
  return request('/api/auth/login', { method: 'POST', body: { username, password } })
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' })
}

export function getCurrentUser() {
  return request('/api/auth/me')
}
