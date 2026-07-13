const LS_USERS_KEY = 'cr_users_v1'
const LS_SESSION_KEY = 'cr_session_v1'

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users))
}

export function registerUser({ username, password }) {
  const u = (username || '').trim()
  const p = password || ''
  if (!u) return { ok: false, error: 'Username is required.' }
  if (p.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' }

  const users = readUsers()
  if (users.some((x) => x.username.toLowerCase() === u.toLowerCase())) {
    return { ok: false, error: 'Username already exists.' }
  }

  // NOTE: demo-only. Do not store plaintext passwords in production.
  users.push({ username: u, password: p })
  writeUsers(users)
  return { ok: true }
}

export function loginUser({ username, password }) {
  const u = (username || '').trim()
  const p = password || ''
  if (!u || !p) return { ok: false, error: 'Username and password are required.' }

  const users = readUsers()
  const found = users.find((x) => x.username.toLowerCase() === u.toLowerCase())
  if (!found || found.password !== p) {
    return { ok: false, error: 'Invalid username or password.' }
  }

  const sessionToken = crypto.randomUUID()
  localStorage.setItem(LS_SESSION_KEY, JSON.stringify({ token: sessionToken, username: found.username }))
  return { ok: true, token: sessionToken }
}

export function logout() {
  localStorage.removeItem(LS_SESSION_KEY)
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function isAuthenticated() {
  const s = getSession()
  return !!(s && s.token)
}

export function getCurrentUser() {
  const s = getSession()
  return s?.username || null
}

