import { request } from './client.js'

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
