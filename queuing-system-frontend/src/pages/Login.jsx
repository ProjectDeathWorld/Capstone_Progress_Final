import { useState, useRef } from 'react'
import { login } from '../api'
import { isMiniStaffUser, prepareStaffMiniWindow } from '../utils/staffMiniWindow'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const authenticatedAttempt = useRef(null)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const cached = authenticatedAttempt.current
      // Retry a blocked window from a fresh click without a second login/token.
      const data = cached && sessionStorage.getItem('token') === cached.token
        ? cached : await login(username, password)
      if (data.token) {
        authenticatedAttempt.current = data
        const miniWindow = isMiniStaffUser(data.user)
          ? prepareStaffMiniWindow(window, data.user.user_id)
          : null
        await onLogin(data.user, data.token, miniWindow)
        authenticatedAttempt.current = null
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      setError(err?.message || 'Unable to process login. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="staff-login-page">
      <header className="staff-login-header">
        <div className="staff-login-brand">
          <div className="staff-login-logo">
            <img src="/loa-logo.png" alt="Lyceum logo" />
          </div>
          <div className="staff-login-brand-copy">
            <span className="staff-login-brand-name">LYCEUM OF ALABANG</span>
            <span className="staff-login-brand-tag">Queue Management System</span>
          </div>
        </div>
      </header>
      <main className="staff-login-card">
        <h2>Staff Login</h2>
        <form className="staff-login-form" onSubmit={handleSubmit}>
          <div className="staff-login-field">
            <label htmlFor="staff-login-username">Username</label>
            <input
              id="staff-login-username"
              type="text"
              value={username}
              onChange={(e) => { authenticatedAttempt.current = null; setUsername(e.target.value) }}
              required
              autoFocus
            />
          </div>
          <div className="staff-login-field">
            <label htmlFor="staff-login-password">Password</label>
            <input
              id="staff-login-password"
              type="password"
              value={password}
              onChange={(e) => { authenticatedAttempt.current = null; setPassword(e.target.value) }}
              required
            />
          </div>
          {error && <div className="staff-login-error">{error}</div>}
          <button type="submit" className="staff-login-submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default Login
