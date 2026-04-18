import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import './Dashboard.css'
import { INDUSTRIES, STATUSES, STATUS_COLORS, INDIAN_STATES, SAMPLE_DATA, SHEET_URLS, SYNC_INTERVAL_MS } from '../config'

const STORAGE_KEY   = 'mb_contacts_v2'
const LAST_SYNC_KEY = 'mb_last_sync'
const TABS = ['All', ...INDUSTRIES]

function loadContacts() {
  try {
    const d = localStorage.getItem(STORAGE_KEY)
    return d ? JSON.parse(d) : SAMPLE_DATA
  } catch {
    return SAMPLE_DATA
  }
}

function saveContacts(c) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch {}
}

const pick = (row, ...keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return String(row[k])
  }
  return ''
}

function parseSheetRows(text) {
  try {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true })
    return result.data.map(row => {
      const fullName  = pick(row, 'Full Name', 'full name', 'FullName')
      const firstName = pick(row, 'First Name', 'first name', 'FirstName')
      const lastName  = pick(row, 'Last Name', 'last name', 'LastName')
      const name = fullName || (firstName || lastName ? (firstName + ' ' + lastName).trim() : pick(row, 'Name', 'name', 'Contact Name'))
      return {
        name,
        company: pick(row, 'Company Name', 'Company', 'company', 'Organization'),
        email:   pick(row, 'Email ID', 'Email', 'email', 'E-mail'),
        phone:   pick(row, 'Contact', 'Phone', 'phone', 'Mobile', 'Phone Number'),
      }
    }).filter(r => r.name || r.company)
  } catch {
    return []
  }
}

function matchContact(sheetRow, contacts) {
  const norm = s => (s || '').toLowerCase().trim()
  const sName = norm(sheetRow.name)
  const sComp = norm(sheetRow.company)
  if (sName) {
    const found = contacts.find(c => norm(c.name) === sName)
    if (found) return found
  }
  if (sComp) {
    const found = contacts.find(c => norm(c.company) === sComp)
    if (found) return found
  }
  return null
}

function formatAgo(ts) {
  if (!ts) return null
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5)   return 'just now'
  if (secs < 60)  return secs + 's ago'
  if (secs < 120) return '1 min ago'
  if (secs < 3600) return Math.floor(secs / 60) + ' min ago'
  return Math.floor(secs / 3600) + 'h ago'
}

async function fetchAllSheets(currentContacts) {
  let updated = 0
  let next = currentContacts.slice()
  const industries = Object.keys(SHEET_URLS)

  await Promise.all(industries.map(async function(industry) {
    const url = SHEET_URLS[industry]
    if (!url) return
    try {
      const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(url))
      if (!res.ok) return
      const text = await res.text()
      const rows = parseSheetRows(text)
      rows.forEach(function(sheetRow) {
        const matched = matchContact(sheetRow, next)
        if (!matched) return
        const patch = {}
        if (sheetRow.email && sheetRow.email !== matched.email) patch.email = sheetRow.email
        if (sheetRow.phone && sheetRow.phone !== matched.phone) patch.phone = sheetRow.phone
        if (Object.keys(patch).length > 0) {
          updated++
          next = next.map(function(c) { return c.id === matched.id ? Object.assign({}, c, patch) : c })
        }
      })
    } catch (e) {
      // network error — skip this sheet silently
    }
  }))

  return { updated: updated, contacts: next }
}

export default function Dashboard({ onLogout }) {
  const [contacts, setContacts] = useState(loadContacts)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [notesModal, setNotesModal] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [lastSyncTs, setLastSyncTs] = useState(function() {
    try {
      const v = localStorage.getItem(LAST_SYNC_KEY)
      return v ? Number(v) : null
    } catch { return null }
  })
  const [ticker, setTicker] = useState(0)

  const editRef = useRef(null)
  const syncingRef = useRef(false)
  const contactsRef = useRef(contacts)

  // keep ref in sync so async callbacks always see latest contacts
  useEffect(function() { contactsRef.current = contacts }, [contacts])
  useEffect(function() { saveContacts(contacts) }, [contacts])
  useEffect(function() {
    if (editingCell && editRef.current) editRef.current.focus()
  }, [editingCell])

  // ticker to refresh "X sec ago"
  useEffect(function() {
    var t = setInterval(function() { setTicker(function(n) { return n + 1 }) }, 15000)
    return function() { clearInterval(t) }
  }, [])

  const doSync = useCallback(function() {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    setSyncMsg('')
    fetchAllSheets(contactsRef.current).then(function(result) {
      if (result.updated > 0) setContacts(result.contacts)
      var now = Date.now()
      setLastSyncTs(now)
      try { localStorage.setItem(LAST_SYNC_KEY, String(now)) } catch {}
      setSyncMsg(result.updated > 0 ? result.updated + ' updated' : 'Up to date')
      setSyncing(false)
      syncingRef.current = false
    }).catch(function() {
      setSyncing(false)
      syncingRef.current = false
    })
  }, [])

  // initial sync on mount
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

  function updateContact(id, field, value) {
    setContacts(function(prev) { return prev.map(function(c) { return c.id === id ? Object.assign({}, c, { [field]: value }) : c }) })
  }
  function startEdit(id, field, value)  { setEditingCell(id + '__' + field); setEditValue(value || '') }
  function commitEdit(id, field)         { updateContact(id, field, editValue); setEditingCell(null) }
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

  function resetToSample() {
    if (confirm('Reset to sample data? This will clear all current contacts.')) setContacts(SAMPLE_DATA)
  }

  var agoText = syncing ? 'Fetching...' : (lastSyncTs ? '🔄 Last synced: ' + formatAgo(lastSyncTs) : '🔄 Starting...')

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
          <button className="btn-ghost" onClick={exportCSV}>
            📤 Export {filtered.length}
          </button>
          <button className="btn-ghost btn-icon" onClick={resetToSample} title="Reset to sample data">🔄</button>
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
                      onChange={function(e) { updateContact(c.id, 'status', e.target.value) }}>
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
          onSave={function(notes) { updateContact(notesModal.id, 'notes', notes); setNotesModal(null) }}
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
