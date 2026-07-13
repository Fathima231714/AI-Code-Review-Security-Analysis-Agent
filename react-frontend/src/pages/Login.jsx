import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser, getCurrentUser } from '../lib/auth'
import './auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // If already logged in, go to review page.
  const current = getCurrentUser()
  if (current) {
    // Avoid extra effect deps; redirect immediately.
    navigate('/', { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = loginUser({ username, password })
      if (!res.ok) {
        setError(res.error || 'Login failed.')
        return
      }
      navigate('/', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Login</h1>
        <p className="auth-subtitle">Access AI code review after signing in.</p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="auth-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <span>New here?</span> <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  )
}

