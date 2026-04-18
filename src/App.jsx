import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

const SESSION_KEY = 'mb_auth'

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  const handleLogin = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setAuthed(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }

  if (!authed) return <Login onLogin={handleLogin} />
  return <Dashboard onLogout={handleLogout} />
}
