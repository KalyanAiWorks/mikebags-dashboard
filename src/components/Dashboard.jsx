import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import './Dashboard.css'
import { INDUSTRIES, STATUSES, STATUS_COLORS, INDIAN_STATES, SHEET_URLS, SYNC_INTERVAL_MS } from '../config'

// localStorage stores only user overrides (status, notes) — not all contacts
const OVERRIDES_KEY = 'mb_overrides_v1'
const LAST_SYNC_KEY = 'mb_last_sync'
const TABS = ['All', ...INDUSTRIES]

function loadOverrides() {
  try { const d = localStorage.getItem(OVERRIDES_KEY); return d ? JSON.parse(d) : {} } catch { return {} }
}
function saveOverrides(o) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)) } catch {}
}

// stable ID — industry + normalized company + normalized name
function makeId(industry, company, name) {
  const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)
  return slug(industry) + '__' + slug(company) + '__' + slug(name)
}

const pick = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return String(row[k]).trim()
  }
  return ''
}

function parseSheetToContacts(text, industry, overrides) {
  try {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true })
    return result.data.map(function(row) {
      const fullName  = pick(row, 'Full Name', 'full name', 'FullName')
      const firstName = pick(row, 'First Name', 'first name', 'FirstName')
      const lastName  = pick(row, 'Last Name', 'last name', 'LastName')
      const name      = fullName || ((firstName || lastName) ? (firstName + ' ' + lastName).trim() : pick(row, 'Name', 'name', 'Contact Name'))
      const company   = pick(row, 'Company Name', 'Company', 'company', 'Organization')
      const location  = pick(row, 'Location', 'location', 'City', 'city')
      const id        = makeId(industry, company, name)
      const override  = overrides[id] || {}
      return {
        id,
        name,
        company,
        jobTitle: pick(row, 'Job Title', 'jobTitle', 'Title', 'Designation', 'Role'),
        location,
        state:    pick(row, 'State', 'state') || location,
        industry,
        linkedin: pick(row, 'LinkedIn Profile', 'LinkedIn URL', 'LinkedIn', 'linkedin'),
        email:    pick(row, 'Email ID', 'Email', 'email', 'E-mail', 'EmailID'),
        phone:    pick(row, 'Contact', 'Phone', 'phone', 'Mobile', 'mobile', 'Phone Number'),
        status:   override.status || 'New',
        notes:    override.notes  || '',
      }
    }).filter(function(c) { return c.name || c.company })
  } catch (e) {
    console.error('[parse] ' + industry + ':', e)
    return []
  }
}

function formatAgo(ts) {
  if (!ts) return null
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5)    return 'just now'
  if (secs < 60)   return secs + 's ago'
  if (secs < 120)  return '1 min ago'
  if (secs < 3600) return Math.floor(secs / 60) + ' min ago'
  return Math.floor(secs / 3600) + 'h ago'
}

async function fetchAllSheets(overrides) {
  const allContacts = []
  const errors = []

  await Promise.all(Object.keys(SHEET_URLS).map(async function(industry) {
    const url = SHEET_URLS[industry]
    try {
      const res = await fetch(url)
      if (!res.ok) { errors.push(industry + ': HTTP ' + res.status); return }
      const text = await res.text()
      const contacts = parseSheetToContacts(text, industry, overrides)
      console.log('[sync] ' + industry + ': ' + contacts.length + ' contacts')
      allContacts.push(...contacts)
    } catch (e) {
      errors.push(industry + ': ' + e.message)
      console.error('[sync] ' + industry + ' failed:', e)
    }
  }))

  if (errors.length) console.warn('[sync] errors:', errors)
  return { contacts: allContacts, errors }
}

export default function Dashboard({ onLogout }) {
  const [contacts, setContacts]       = useState([])
  const [overrides, setOverrides]     = useState(loadOverrides)
  const [loading, setLoading]         = useState(true)   // true until first fetch done
  const [activeTab, setActiveTab]     = useState('All')
  const [search, setSearch]           = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue]     = useState('')
  const [notesModal, setNotesModal]   = useState(null)
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState('')
  const [lastSyncTs, setLastSyncTs]   = useState(function() {
    try { const v = localStorage.getItem(LAST_SYNC_KEY); return v ? Number(v) : null } catch { return null }
  })
  const [ticker, setTicker]           = useState(0)

  const editRef     = useRef(null)
  const syncingRef  = useRef(false)
  const overridesRef = useRef(overrides)

  useEffect(function() { overridesRef.current = overrides; saveOverrides(overrides) }, [overrides])
  useEffect(function() { if (editingCell && editRef.current) editRef.current.focus() }, [editingCell])
  useEffect(function() {
    var t = setInterval(function() { setTicker(function(n) { return n + 1 }) }, 15000)
    return function() { clearInterval(t) }
  }, [])

  const doSync = useCallback(function() {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    setSyncMsg('')
    fetchAllSheets(overridesRef.current).then(function(result) {
      setContacts(result.contacts)
      setLoading(false)
      var now = Date.now()
      setLastSyncTs(now)
      try { localStorage.setItem(LAST_SYNC_KEY, String(now)) } catch {}
      var msg = result.contacts.length + ' contacts loaded'
      if (result.errors.length) msg += ' ⚠️ ' + result.errors.length + ' failed'
      setSyncMsg(msg)
      setSyncing(false)
      syncingRef.current = false
    }).catch(function(e) {
      console.error('[sync] fatal:', e)
      setSyncMsg('❌ ' + e.message)
      setLoading(false)
      setSyncing(false)
      syncingRef.current = false
    })
  }, [])

  // initial fetch on mount
  useEffect(function() { doSync() }, [doSync])

  // auto-poll every 60s
  useEffect(function() {
    var t = setInterval(doSync, SYNC_INTERVAL_MS)
    return function() { clearInterval(t) }
  }, [doSync])

  const filtered = useMemo(function() {
    return contacts.filter(function(c) {
      if (activeTab !== 'All' && c.industry !== activeTab) return false
      if (stateFilter !== 'All States' && c.state !== stateFilter) return false
      if (statusFilter !== 'All' && c.status !== statusFilter) return false
      if (search) {
        var q = search.toLowerCase()
        return (c.name || '').toLowerCase().indexOf(q) !== -1 ||
          (c.company || '').toLowerCase().indexOf(q) !== -1 ||
          (c.location || '').toLowerCase().indexOf(q) !== -1 ||
          (c.email || '').toLowerCase().indexOf(q) !== -1
      }
      return true
    })
  }, [contacts, activeTab, stateFilter, statusFilter, search])

  const stats = useMemo(function() {
    var base = activeTab === 'All' ? contacts : contacts.filter(function(c) { return c.industry === activeTab })
    return {
      total:      base.length,
      contacted:  base.filter(function(c) { return ['Contacted','Interested','Meeting Scheduled','Deal Closed'].indexOf(c.status) !== -1 }).length,
      interested: base.filter(function(c) { return ['Interested','Meeting Scheduled'].indexOf(c.status) !== -1 }).length,
      closed:     base.filter(function(c) { return c.status === 'Deal Closed' }).length,
    }
  }, [contacts, activeTab])

  function updateOverride(id, field, value) {
    setOverrides(function(prev) {
      var next = Object.assign({}, prev)
      next[id] = Object.assign({}, next[id] || {}, { [field]: value })
      return next
    })
    // also update contacts in-memory so UI reflects immediately
    setContacts(function(prev) {
      return prev.map(function(c) { return c.id === id ? Object.assign({}, c, { [field]: value }) : c })
    })
  }

  function startEdit(id, field, value)  { setEditingCell(id + '__' + field); setEditValue(value || '') }
  function commitEdit(id, field)         { updateOverride(id, field, editValue); setEditingCell(null) }
  function handleEditKeyDown(e, id, field) {
    if (e.key === 'Enter') commitEdit(id, field)
    if (e.key === 'Escape') setEditingCell(null)
  }

  function exportCSV() {
    var fields  = ['name','company','jobTitle','location','state','industry','linkedin','email','phone','status','notes']
    var headers = ['Name','Company','Job Title','Location','State','Industry','LinkedIn','Email','Phone','Status','Notes']
    var rows = [headers].concat(filtered.map(function(c) {
      return fields.map(function(f) { return '"' + (c[f] || '').replace(/"/g, '""') + '"' })
    }))
    var blob = new Blob([rows.map(function(r) { return r.join(',') }).join('\n')], { type: 'text/csv' })
    var a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'mikebags_leads_' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
  }

  function debugFetch() {
    var url = Object.values(SHEET_URLS)[0]
    alert('Testing fetch of Education Schools...\n' + url)
    fetch(url).then(function(res) {
      return res.text().then(function(text) {
        alert('HTTP ' + res.status + '\nCORS: ' + res.headers.get('access-control-allow-origin') + '\nRows: ' + text.split('\n').length + '\nFirst 400 chars:\n' + text.slice(0, 400))
      })
    }).catch(function(e) { alert('FETCH FAILED:\n' + e.message) })
  }

  var agoText = syncing ? 'Fetching sheets...' : (lastSyncTs ? '🔄 Last synced: ' + formatAgo(lastSyncTs) : '🔄 Loading...')

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Loading contacts from Google Sheets...</div>
          <div className="loading-sub">Fetching all 7 industry sheets</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="header-left">
          <span className="header-logo">🎒</span>
          <div>
            <h1 className="header-title">Mike Bags</h1>
            <span className="header-sub">Sales Intelligence</span>
          </div>
        </div>

        <div className="header-center">
          <span className={syncing ? 'sync-badge syncing' : 'sync-badge active'}>
            <span className="sync-dot" />
            {syncing ? 'Syncing...' : 'Live'}
          </span>
          <span className="last-sync" key={ticker}>
            {agoText}
            {!syncing && syncMsg ? <span className="sync-diff"> · {syncMsg}</span> : null}
          </span>
        </div>

        <div className="header-right">
          <button className="btn-ghost" onClick={doSync} disabled={syncing}>
            {syncing ? '⟳ Syncing…' : '⟳ Sync Now'}
          </button>
          <button className="btn-ghost" onClick={debugFetch} title="Test raw fetch">
            🐛 Debug
          </button>
          <button className="btn-ghost" onClick={exportCSV}>
            📤 Export {filtered.length}
          </button>
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className="stats-row">
        <StatCard label="Total Leads"  value={stats.total}      icon="👥" color="#2979ff" />
        <StatCard label="Contacted"    value={stats.contacted}  icon="📞" color="#00bcd4" />
        <StatCard label="Interested"   value={stats.interested} icon="🔥" color="#ffab00" />
        <StatCard label="Deals Closed" value={stats.closed}     icon="🏆" color="#00c853" />
      </div>

      <div className="tabs-bar">
        {TABS.map(function(tab) {
          return (
            <button key={tab} className={'tab-btn' + (activeTab === tab ? ' active' : '')} onClick={function() { setActiveTab(tab) }}>
              {tab}
              {tab !== 'All' && (
                <span className="tab-count">{contacts.filter(function(c) { return c.industry === tab }).length}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-input"
            placeholder="Search name, company, location, email..."
            value={search} onChange={function(e) { setSearch(e.target.value) }} />
          {search && <button className="clear-search" onClick={function() { setSearch('') }}>×</button>}
        </div>
        <select value={stateFilter} onChange={function(e) { setStateFilter(e.target.value) }} className="filter-select">
          {INDIAN_STATES.map(function(s) { return <option key={s}>{s}</option> })}
        </select>
        <select value={statusFilter} onChange={function(e) { setStatusFilter(e.target.value) }} className="filter-select">
          <option value="All">All Status</option>
          {STATUSES.map(function(s) { return <option key={s}>{s}</option> })}
        </select>
        <span className="result-count">{filtered.length} contacts</span>
      </div>

      <div className="table-wrap">
        <table className="contacts-table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Company</th><th>Job Title</th>
              <th>Location</th><th>Industry</th><th>LinkedIn</th>
              <th>Email</th><th>Phone</th><th>Status</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="empty-state">No contacts found.</td></tr>
            )}
            {filtered.map(function(c, idx) {
              return (
                <tr key={c.id} className={'status-row status-' + c.status.replace(/\s+/g,'-').toLowerCase()}>
                  <td className="idx-cell">{idx + 1}</td>
                  <td className="name-cell">
                    <span className="status-dot" style={{ background: STATUS_COLORS[c.status] || '#999' }} />
                    {c.name}
                  </td>
                  <td>{c.company}</td>
                  <td>{c.jobTitle}</td>
                  <td>{c.location}</td>
                  <td><span className="industry-badge">{c.industry}</span></td>
                  <td>
                    {c.linkedin
                      ? <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="link-btn">LinkedIn →</a>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {editingCell === c.id + '__email'
                      ? <input ref={editRef} className="cell-input" value={editValue}
                          onChange={function(e) { setEditValue(e.target.value) }}
                          onBlur={function() { commitEdit(c.id, 'email') }}
                          onKeyDown={function(e) { handleEditKeyDown(e, c.id, 'email') }} />
                      : <span className="editable-cell" onClick={function() { startEdit(c.id, 'email', c.email) }}>
                          {c.email || <span className="text-muted add-hint">+ Add</span>}
                        </span>}
                  </td>
                  <td>
                    {editingCell === c.id + '__phone'
                      ? <input ref={editRef} className="cell-input" value={editValue}
                          onChange={function(e) { setEditValue(e.target.value) }}
                          onBlur={function() { commitEdit(c.id, 'phone') }}
                          onKeyDown={function(e) { handleEditKeyDown(e, c.id, 'phone') }} />
                      : <span className="editable-cell" onClick={function() { startEdit(c.id, 'phone', c.phone) }}>
                          {c.phone || <span className="text-muted add-hint">+ Add</span>}
                        </span>}
                  </td>
                  <td>
                    <select className="status-select"
                      style={{ borderColor: STATUS_COLORS[c.status], color: STATUS_COLORS[c.status] }}
                      value={c.status}
                      onChange={function(e) { updateOverride(c.id, 'status', e.target.value) }}>
                      {STATUSES.map(function(s) { return <option key={s} value={s}>{s}</option> })}
                    </select>
                  </td>
                  <td>
                    <button className="notes-btn" onClick={function() { setNotesModal(c) }} title={c.notes || 'Add notes'}>
                      {c.notes ? '📝' : '+ Note'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {notesModal && (
        <NotesModal
          contact={notesModal}
          onSave={function(notes) { updateOverride(notesModal.id, 'notes', notes); setNotesModal(null) }}
          onClose={function() { setNotesModal(null) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-icon" style={{ color: color }}>{icon}</div>
      <div className="stat-value" style={{ color: color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function NotesModal({ contact, onSave, onClose }) {
  var [text, setText] = useState(contact.notes || '')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={function(e) { e.stopPropagation() }}>
        <div className="modal-header">
          <h3>📝 Notes — {contact.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <textarea className="notes-textarea" value={text}
          onChange={function(e) { setText(e.target.value) }}
          placeholder="Add notes about this contact..." autoFocus rows={6} />
        <div className="modal-actions">
          <button className="btn-accent" onClick={function() { onSave(text) }}>Save Notes</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
