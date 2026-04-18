import React, { useState } from 'react'
import './Login.css'

const PASSWORD = 'MikeBags@2026'

export default function Login({ onLogin }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      if (pw === PASSWORD) {
        onLogin()
      } else {
        setError('Incorrect password. Please try again.')
        setLoading(false)
        setPw('')
      }
    }, 600)
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">🎒</span>
          <h1>Mike Bags</h1>
          <p>Sales Intelligence Dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field-group">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setError('') }}
                placeholder="Enter dashboard password"
                autoFocus
              />
              <button type="button" className="toggle-pw" onClick={() => setShow(!show)}>
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading || !pw}>
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>
        <div className="login-footer">Authorized personnel only</div>
      </div>
    </div>
  )
}
