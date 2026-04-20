import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import './Dashboard.css'
import { INDUSTRIES, STATUSES, STATUS_COLORS, INDIAN_STATES, SHEET_URLS, DATA_URL, SYNC_INTERVAL_MS } from '../config'

// localStorage: only overrides (status, notes) — full contacts come from sheets every sync
const OVERRIDES_KEY = 'mb_overrides_v1'
const LAST_SYNC_KEY = 'mb_last_sync'
const TABS = ['All', ...INDUSTRIES]

function loadOverrides() {
  try { var d = localStorage.getItem(OVERRIDES_KEY); return d ? JSON.parse(d) : {} } catch { return {} }
}
function saveOverrides(o) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)) } catch {}
}

function makeId(industry, company, name) {
  var slug = function(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) }
  return slug(industry) + '__' + slug(company) + '__' + slug(name)
}

function str(v) { return (v === undefined || v === null) ? '' : String(v).trim() }

// Parse CSV text manually by column index — no header-name dependency
// Columns: 0=Company, 1=FirstName, 2=LastName, 3=FullName, 4=JobTitle,
//          5=Location, 6=Domain(skip), 7=LinkedIn, 8=Email, 9=Phone
function parseCSVByIndex(csvText, industry, overrides) {
  console.log('[csv] ' + industry + ' raw length:', csvText.length, 'chars')

  // Split into lines, handle \r\n or \n
  var lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  console.log('[csv] ' + industry + ' total lines:', lines.length)

  var contacts = []

  for (var i = 1; i < lines.length; i++) {  // skip header row 0
    var line = lines[i].trim()
    if (!line) continue

    // Simple CSV field split respecting quoted fields
    var fields = splitCSVLine(line)

    var company  = str(fields[0])
    var firstName = str(fields[1])
    var lastName  = str(fields[2])
    var fullName  = str(fields[3])
    var jobTitle  = str(fields[4])
    var location  = str(fields[5])
    var linkedin  = str(fields[7])
    var email     = str(fields[8])
    var phone     = str(fields[9])

    var name = fullName || (firstName || lastName ? (firstName + ' ' + lastName).trim() : '')

    if (!name && !company) continue  // skip empty rows

    var id = makeId(industry, company, name)
    var ov = overrides[id] || {}

    contacts.push({
      id:       id,
      name:     name,
      company:  company,
      jobTitle: jobTitle,
      location: location,
      state:    location,  // use location as state (no separate State column)
      industry: industry,
      linkedin: linkedin,
      email:    email,
      phone:    phone,
      status:   ov.status || 'New',
      notes:    ov.notes  || '',
    })
  }

  console.log('[csv] ' + industry + ' parsed contacts:', contacts.length)
  if (contacts.length > 0) {
    console.log('[csv] ' + industry + ' sample row:', JSON.stringify(contacts[0]))
  }
  return contacts
}

// CSV line splitter that handles quoted fields
function splitCSVLine(line) {
  var fields = []
  var cur = ''
  var inQuote = false
  for (var i = 0; i < line.length; i++) {
    var ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

function formatAgo(ts) {
  if (!ts) return null
  var secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5)    return 'just now'
  if (secs < 60)   return secs + 's ago'
  if (secs < 120)  return '1 min ago'
  if (secs < 3600) return Math.floor(secs / 60) + ' min ago'
  return Math.floor(secs / 3600) + 'h ago'
}

async function fetchAllSheets(overrides) {
  var results = []
  var errors = []
  var industries = Object.keys(SHEET_URLS)

  console.log('[sync] fetching', industries.length, 'sheets via CORS proxy')

  var fetches = industries.map(async function(industry) {
    var url = SHEET_URLS[industry]
    try {
      var res = await fetch(url)
      if (!res.ok) { errors.push(industry + ': HTTP ' + res.status); return }
      var text = await res.text()
      var contacts = parseCSVByIndex(text, industry, overrides)
      results.push(...contacts)
    } catch (e) {
      errors.push(industry + ': ' + e.message)
    }
  })

  await Promise.all(fetches)

  // Fallback to local JSON if all CORS requests failed
  if (results.length === 0 && errors.length > 0) {
    console.log('[sync] CORS failed, loading from local cache')
    try {
      var res = await fetch(DATA_URL)
      if (res.ok) {
        var contacts = await res.json()
        contacts.forEach(function(c) {
          var ov = overrides[c.id]
          if (ov) { c.status = ov.status || c.status; c.notes = ov.notes || c.notes }
        })
        return { contacts: contacts, errors: ['Live sync failed, using cached data'] }
      }
    } catch (e) {}
  }

  return { contacts: results, errors: errors }
}

async function fetchContacts(overrides) {
  return fetchAllSheets(overrides)
}

export default function Dashboard({ onLogout }) {
  var [contacts, setContacts]       = useState([])
  var [overrides, setOverrides]     = useState(loadOverrides)
  var [loading, setLoading]         = useState(true)
  var [activeTab, setActiveTab]     = useState('All')
  var [search, setSearch]           = useState('')
  var [stateFilter, setStateFilter] = useState('All States')
  var [statusFilter, setStatusFilter] = useState('All')
  var [editingCell, setEditingCell] = useState(null)
  var [editValue, setEditValue]     = useState('')
  var [notesModal, setNotesModal]   = useState(null)
  var [syncing, setSyncing]         = useState(false)
  var [syncMsg, setSyncMsg]         = useState('')
  var [lastSyncTs, setLastSyncTs]   = useState(function() {
    try { var v = localStorage.getItem(LAST_SYNC_KEY); return v ? Number(v) : null } catch { return null }
  })
  var [ticker, setTicker] = useState(0)

  var editRef      = useRef(null)
  var syncingRef   = useRef(false)
  var overridesRef = useRef(overrides)

  useEffect(function() { overridesRef.current = overrides; saveOverrides(overrides) }, [overrides])
  useEffect(function() { if (editingCell && editRef.current) editRef.current.focus() }, [editingCell])
  useEffect(function() {
    var t = setInterval(function() { setTicker(function(n) { return n + 1 }) }, 15000)
    return function() { clearInterval(t) }
  }, [])

  var doSync = useCallback(function() {
    if (syncingRef.current) { console.log('[sync] already syncing, skipping'); return }
    syncingRef.current = true
    setSyncing(true)
    setSyncMsg('')
    console.log('[sync] doSync called, overrides count:', Object.keys(overridesRef.current).length)
    fetchAllSheets(overridesRef.current).then(function(result) {
      console.log('[sync] setting contacts:', result.contacts.length)
      setContacts(result.contacts)
      setLoading(false)
      var now = Date.now()
      setLastSyncTs(now)
      try { localStorage.setItem(LAST_SYNC_KEY, String(now)) } catch {}
      var msg = result.contacts.length + ' contacts'
      if (result.errors.length) msg += ' ⚠️ ' + result.errors.length + ' sheet(s) failed'
      setSyncMsg(msg)
      setSyncing(false)
      syncingRef.current = false
    }).catch(function(e) {
      console.error('[sync] FATAL:', e)
      setSyncMsg('❌ ' + e.message)
      setLoading(false)
      setSyncing(false)
      syncingRef.current = false
    })
  }, [])

  useEffect(function() { doSync() }, [doSync])

  useEffect(function() {
    var t = setInterval(doSync, SYNC_INTERVAL_MS)
    return function() { clearInterval(t) }
  }, [doSync])

  var filtered = useMemo(function() {
    return contacts.filter(function(c) {
      if (activeTab !== 'All' && c.industry !== activeTab) return false
      if (stateFilter !== 'All States' && c.state !== stateFilter) return false
      if (statusFilter !== 'All' && c.status !== statusFilter) return false
      if (search) {
        var q = search.toLowerCase()
        return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
          (c.company || '').toLowerCase().indexOf(q) >= 0 ||
          (c.location || '').toLowerCase().indexOf(q) >= 0 ||
          (c.email || '').toLowerCase().indexOf(q) >= 0
      }
      return true
    })
  }, [contacts, activeTab, stateFilter, statusFilter, search])

  var stats = useMemo(function() {
    var base = activeTab === 'All' ? contacts : contacts.filter(function(c) { return c.industry === activeTab })
    return {
      total:      base.length,
      contacted:  base.filter(function(c) { return ['Contacted','Interested','Meeting Scheduled','Deal Closed'].indexOf(c.status) >= 0 }).length,
      interested: base.filter(function(c) { return ['Interested','Meeting Scheduled'].indexOf(c.status) >= 0 }).length,
      closed:     base.filter(function(c) { return c.status === 'Deal Closed' }).length,
    }
  }, [contacts, activeTab])

  function updateOverride(id, field, value) {
    setOverrides(function(prev) {
      var next = Object.assign({}, prev)
      next[id] = Object.assign({}, next[id] || {}, { [field]: value })
      return next
    })
    setContacts(function(prev) {
      return prev.map(function(c) { return c.id === id ? Object.assign({}, c, { [field]: value }) : c })
    })
  }

  function startEdit(id, field, value)  { setEditingCell(id + '__' + field); setEditValue(value || '') }
  function commitEdit(id, field)        { updateOverride(id, field, editValue); setEditingCell(null) }
  function handleEditKeyDown(e, id, field) {
    if (e.key === 'Enter')  commitEdit(id, field)
    if (e.key === 'Escape') setEditingCell(null)
  }

  function exportCSV() {
    var fields  = ['name','company','jobTitle','location','industry','linkedin','email','phone','status','notes']
    var headers = ['Name','Company','Job Title','Location','Industry','LinkedIn','Email','Phone','Status','Notes']
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
    var url = SHEET_URLS['Education Schools']
    console.log('[debug] fetching:', url)
    fetch(url).then(function(res) {
      console.log('[debug] HTTP', res.status, 'CORS:', res.headers.get('access-control-allow-origin'))
      return res.text()
    }).then(function(text) {
      var lines = text.replace(/\r\n/g, '\n').split('\n')
      console.log('[debug] lines:', lines.length)
      console.log('[debug] header row:', lines[0])
      console.log('[debug] first data row:', lines[1])
      alert('Education Schools fetch result:\n' +
        'Lines: ' + lines.length + '\n' +
        'Header: ' + lines[0].slice(0,80) + '\n' +
        'Row 1: ' + lines[1].slice(0,120))
    }).catch(function(e) {
      console.error('[debug] fetch failed:', e)
      alert('FETCH FAILED: ' + e.message)
    })
  }

  var agoText = syncing
    ? 'Fetching all sheets...'
    : (lastSyncTs ? '🔄 Last synced: ' + formatAgo(lastSyncTs) : '🔄 Loading...')

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
          <button className="btn-ghost" onClick={debugFetch}>🐛 Debug</button>
          <button className="btn-ghost" onClick={exportCSV}>📤 Export {filtered.length}</button>
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
          var count = tab === 'All' ? contacts.length : contacts.filter(function(c) { return c.industry === tab }).length
          return (
            <button key={tab} className={'tab-btn' + (activeTab === tab ? ' active' : '')}
              onClick={function() { setActiveTab(tab) }}>
              {tab}
              <span className="tab-count">{count}</span>
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
              <tr><td colSpan={11} className="empty-state">
                No contacts. Check console (F12) for sync logs.
              </td></tr>
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
                    <button className="notes-btn" onClick={function() { setNotesModal(c) }}>
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
