import React, { useState, Component } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

const SESSION_KEY = 'mb_auth'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', color: '#ff6b6b', fontFamily: 'monospace', background: '#0a0a0a', minHeight: '100vh' }}>
          <h2>App Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '16px', padding: '8px 16px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [authed, setAuthed] = useState(function() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
  })

  function handleLogin() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    setAuthed(true)
  }

  function handleLogout() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    setAuthed(false)
  }

  return (
    <ErrorBoundary>
      {authed ? <Dashboard onLogout={handleLogout} /> : <Login onLogin={handleLogin} />}
    </ErrorBoundary>
  )
}
