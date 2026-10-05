import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { getMe, logout as apiLogout, logoutStaff } from './api'
import Login from './pages/Login'
import Kiosk from './pages/Kiosk'
import QueueDisplay from './pages/QueueDisplay'
import StaffPanel from './pages/StaffPanel'
import AdminPanel from './pages/AdminPanel'
import { isMiniStaffUser, returnToStaffLogin } from './utils/staffMiniWindow'
import { isHeadAdminUser, isDeptAdminUser, getDepartmentDisplayName } from './utils/departments'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const logoutInFlightRef = useRef(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const isMiniStaffView = location.pathname === '/staff'
    && new URLSearchParams(location.search).get('view') === 'mini'
  const [miniLogoutPending, setMiniLogoutPending] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (token) {
      getMe().then(data => {
        if (data.user_id) setUser(data)
        else sessionStorage.removeItem('token')
        setLoading(false)
      }).catch(() => {
        sessionStorage.removeItem('token')
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = async (userData, token, preparedMiniWindow = null) => {
    sessionStorage.setItem('token', token)
    setUser(userData)
    if (isHeadAdminUser(userData)) {
      preparedMiniWindow?.close()
      navigate('/admin', { replace: true })
      return
    }

    if (isDeptAdminUser(userData)) {
      preparedMiniWindow?.close()
      navigate('/dept-admin', { replace: true })
      return
    }

    if (isMiniStaffUser(userData)) {
      const miniWindow = preparedMiniWindow && !preparedMiniWindow.closed
        ? preparedMiniWindow
        : window.open('', `qms-staff-mini-${userData.user_id}`,
          'popup=yes,width=480,height=760,resizable=no,scrollbars=yes,location=yes,toolbar=yes')

      if (miniWindow && !miniWindow.closed) {
        miniWindow.sessionStorage.setItem('token', token)
        miniWindow.location.replace('/staff?view=mini')
        miniWindow.focus()
        return
      }

      setLogoutError('Please allow popups to open the Staff Mini View.')
      sessionStorage.removeItem('token')
      setUser(null)
      return
    }

    preparedMiniWindow?.close()
    navigate('/login')
  }

  const handleLogout = async () => {
    const closingMiniView = isMiniStaffView && user?.role === 'staff'
    if (user?.role !== 'staff') {
      await apiLogout()
      sessionStorage.removeItem('token')
      setUser(null)
      navigate('/login')
      return
    }
    if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    setLogoutPending(true)
    if (closingMiniView) setMiniLogoutPending(true)
    setLogoutError('')
    window.__staffPause?.()
    try {
      window.__staffLogoutToken = sessionStorage.getItem('token')
      await logoutStaff()
      sessionStorage.removeItem('token')
      setUser(null)
      if (closingMiniView) {
        returnToStaffLogin(window)
        window.close()
        return
      }
      navigate('/login')
    } catch (error) {
      setLogoutError(error?.message || 'Logout failed. Please try again.')
      window.__staffResume?.()
      if (closingMiniView) setMiniLogoutPending(false)
    } finally {
      logoutInFlightRef.current = false
      setLogoutPending(false)
    }
  }

  useEffect(() => {
    const onMiniLogoutComplete = event => {
      if (
        event.origin !== window.location.origin
        || event.source === window
        || event.data?.type !== 'STAFF_MINI_LOGOUT_COMPLETE'
        || event.data?.token !== sessionStorage.getItem('token')
      ) return

      window.__staffPause?.()
      sessionStorage.removeItem('token')
      setUser(null)
      setLogoutError('')
      setLogoutPending(false)
      navigate('/login', { replace: true })
      window.focus()
    }

    window.addEventListener('message', onMiniLogoutComplete)
    return () => window.removeEventListener('message', onMiniLogoutComplete)
  }, [navigate])

  if (loading) return <div className="loading">Loading...</div>
  if (miniLogoutPending) return null;


  return (
    <div className="app">
      {location.pathname !== '/' && location.pathname !== '/display' && (
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/">Lyceum of Alabang - Queue System</Link>
          </div>
          <div className="nav-links">
            <Link to="/">Kiosk</Link>
            <Link to="/display">Display Board</Link>
            {!user && <Link to="/login">Staff Login</Link>}
            {user && user.role === 'staff' && (
              <>
                <Link to="/staff">My Panel</Link>
              </>
            )}
            {user && isHeadAdminUser(user) && <Link to="/admin">Head Admin</Link>}
            {user && isDeptAdminUser(user) && (
              <Link to="/dept-admin">{getDepartmentDisplayName(user.department || user.position)} Admin</Link>
            )}
            {user && (
              <button className="btn-logout" onClick={handleLogout} disabled={logoutPending}>
                Logout ({user.full_name})
              </button>
            )}
          </div>
        </nav>
      )}

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Kiosk />} />
          <Route path="/display" element={<QueueDisplay />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/staff" element={
            user && user.role === 'staff'
              ? <StaffPanel key={user.user_id} user={user} onLogout={handleLogout} logoutPending={logoutPending} logoutError={logoutError} />
              : <Login onLogin={handleLogin} />
          } />
          <Route path="/staff/mini" element={<Navigate to="/staff" replace />} />
          <Route path="/admin" element={
            user && (isHeadAdminUser(user) || isDeptAdminUser(user))
              ? (isDeptAdminUser(user) ? <Navigate to="/dept-admin" replace /> : <AdminPanel user={user} />)
              : <Login onLogin={handleLogin} />
          } />
          <Route path="/dept-admin" element={
            user && (isHeadAdminUser(user) || isDeptAdminUser(user))
              ? (isHeadAdminUser(user) ? <Navigate to="/admin" replace /> : <AdminPanel user={user} />)
              : <Login onLogin={handleLogin} />
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App
