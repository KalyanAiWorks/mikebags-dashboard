import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import './Dashboard.css'
import { INDUSTRIES, STATUSES, STATUS_COLORS, INDIAN_STATES, SAMPLE_DATA } from '../config'
import Settings from './Settings'

const STORAGE_KEY    = 'mb_contacts_v2'
const SETTINGS_KEY   = 'mb_settings_v2'
const LAST_SYNC_KEY  = 'mb_last_sync'

const TABS = ['All', ...INDUSTRIES]

// ── helpers ──────────────────────────────────────────────────────────────────

function loadContacts() {
  try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : SAMPLE_DATA } catch { return SAMPLE_DATA }
}
function saveContacts(c) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) }

function loadSettings() {
  try { const d = localStorage.getItem(SETTINGS_KEY); return d ? JSON.parse(d) : {} } catch { return {} }
}

/** Parse one CSV text blob → array of { name, company, email, phone } for matching */
const pick = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k]; return '' }

function parseSheetRows(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })
  return result.data.map(row => {
    const fullName  = pick(row, 'Full Name', 'full name', 'FullName')
    const firstName = pick(row, 'First Name', 'first name', 'FirstName')
    const lastName  = pick(row, 'Last Name', 'last name', 'LastName')
    return {
      name:    fullName || (firstName || lastName ? `${firstName} ${lastName}`.trim() : pick(row, 'Name', 'name', 'Contact Name')),
      company: pick(row, 'Company Name', 'Company', 'company', 'Organization'),
      email:   pick(row, 'Email ID', 'Email', 'email', 'E-mail'),
      phone:   pick(row, 'Contact', 'Phone', 'phone', 'Mobile', 'Phone Number'),
    }
  }).filter(r => r.name || r.company)
}

/** Match sheet row → dashboard contact by name (normalized) or company */
function matchContact(sheetRow, contacts) {
  const norm = s => (s || '').toLowerCase().trim()
  const sName = norm(sheetRow.name)
  const sComp = norm(sheetRow.company)
  if (sName) {
    const byName = contacts.find(c => norm(c.name) === sName)
    if (byName) return byName
  }
  if (sComp) {
    const byComp = contacts.find(c => norm(c.company) === sComp && (!sName || norm(c.name).includes(sName.split(' ')[0])))
    if (byComp) return byComp
  }
  return null
}

function formatAgo(ts) {
  if (!ts) return null
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60)  return 'just now'
  if (secs < 120) return '1 min ago'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  return `${Math.floor(secs / 3600)}h ago`
}

// ── component ────────────────────────────────────────────────────────────────

export default function Dashboard({ onLogout }) {
  const [contacts, setContacts] = useState(loadContacts)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')

  // import panel
  const [importUrl, setImportUrl] = useState('')
  const [importIndustry, setImportIndustry] = useState(INDUSTRIES[0])
  const [importMode, setImportMode] = useState('append')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showImportPanel, setShowImportPanel] = useState(false)

  // settings & sync
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')   // e.g. "3 contacts updated"
  const [lastSyncTs, setLastSyncTs] = useState(() => {
    const v = localStorage.getItem(LAST_SYNC_KEY); return v ? Number(v) : null
  })
  const [ticker, setTicker] = useState(0)     // forces "X min ago" re-render

  // modal
  const [notesModal, setNotesModal] = useState(null)
  const editRef = useRef(null)

  useEffect(() => { saveContacts(contacts) }, [contacts])
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  useEffect(() => { if (editingCell && editRef.current) editRef.current.focus() }, [editingCell])

  // tick every 30s to refresh "X min ago"
  useEffect(() => {
    const t = setInterval(() => setTicker(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── sync engine ────────────────────────────────────────────────────────────

  const runSync = useCallback(async (currentContacts, currentSettings) => {
    const urls = currentSettings.sheetUrls || {}
    const configured = INDUSTRIES.filter(ind => urls[ind])
    if (!configured.length) return { updated: 0, contacts: currentContacts }

    let updated = 0
    let next = [...currentContacts]

    await Promise.all(configured.map(async (industry) => {
      try {
        const rawUrl = urls[industry]
        const url = rawUrl.includes('output=csv') ? rawUrl : rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'output=csv'
        const res  = await fetch(url)
        const text = await res.text()
        const rows = parseSheetRows(text)

        rows.forEach(sheetRow => {
          const matched = matchContact(sheetRow, next)
          if (!matched) return
          let changed = false
          const patch = {}
          if (sheetRow.email && sheetRow.email !== matched.email) { patch.email = sheetRow.email; changed = true }
          if (sheetRow.phone && sheetRow.phone !== matched.phone) { patch.phone = sheetRow.phone; changed = true }
          if (changed) {
            updated++
            next = next.map(c => c.id === matched.id ? { ...c, ...patch } : c)
          }
        })
      } catch { /* skip failed sheet */ }
    }))

    return { updated, contacts: next }
  }, [])

  const doSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setSyncMsg('')
    const snap = contacts     // capture current value
    const snap2 = settings
    const { updated, contacts: next } = await runSync(snap, snap2)
    setContacts(next)
    const now = Date.now()
    setLastSyncTs(now)
    localStorage.setItem(LAST_SYNC_KEY, String(now))
    setSyncMsg(updated ? `${updated} updated` : 'Up to date')
    setSyncing(false)
  }, [contacts, settings, syncing, runSync])

  // polling interval
  useEffect(() => {
    if (!settings.autoSync) return
    const ms = (settings.syncInterval || 60) * 1000
    const t = setInterval(() => {
      setContacts(prev => {
        // run async outside setState — use ref trick via doSync equivalent
        // we call async via a self-invoking function to avoid stale closure
        runSync(prev, settings).then(({ updated, contacts: next }) => {
          if (updated) setContacts(next)
          const now = Date.now()
          setLastSyncTs(now)
          localStorage.setItem(LAST_SYNC_KEY, String(now))
          if (updated) setSyncMsg(`${updated} updated`)
        })
        return prev   // don't change synchronously
      })
    }, ms)
    return () => clearInterval(t)
  }, [settings, runSync])

  // ── derived state ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => contacts.filter(c => {
    if (activeTab !== 'All' && c.industry !== activeTab) return false
    if (stateFilter !== 'All States' && c.state !== stateFilter) return false
    if (statusFilter !== 'All' && c.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    }
    return true
  }), [contacts, activeTab, stateFilter, statusFilter, search])

  const stats = useMemo(() => {
    const base = activeTab === 'All' ? contacts : contacts.filter(c => c.industry === activeTab)
    return {
      total:     base.length,
      contacted: base.filter(c => ['Contacted','Interested','Meeting Scheduled','Deal Closed'].includes(c.status)).length,
      interested: base.filter(c => ['Interested','Meeting Scheduled'].includes(c.status)).length,
      closed:    base.filter(c => c.status === 'Deal Closed').length,
    }
  }, [contacts, activeTab])

  // ── edit helpers ───────────────────────────────────────────────────────────

  const updateContact = (id, field, value) =>
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))

  const startEdit = (id, field, value) => { setEditingCell(`${id}__${field}`); setEditValue(value || '') }
  const commitEdit = (id, field) => { updateContact(id, field, editValue); setEditingCell(null) }
  const handleEditKeyDown = (e, id, field) => {
    if (e.key === 'Enter') commitEdit(id, field)
    if (e.key === 'Escape') setEditingCell(null)
  }

  // ── import ─────────────────────────────────────────────────────────────────

  const importFromUrl = async () => {
    if (!importUrl.trim()) return
    setImporting(true); setImportMsg('')
    try {
      const url = importUrl.includes('output=csv') ? importUrl : importUrl + (importUrl.includes('?') ? '&' : '?') + 'output=csv'
      const res = await fetch(url)
      const text = await res.text()
      const result = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (result.errors.length && !result.data.length) throw new Error('Parse failed')

      const newContacts = result.data.map((row, i) => {
        const fullName  = pick(row, 'Full Name', 'full name', 'FullName')
        const firstName = pick(row, 'First Name', 'first name', 'FirstName')
        const lastName  = pick(row, 'Last Name', 'last name', 'LastName')
        const name      = fullName || (firstName || lastName ? `${firstName} ${lastName}`.trim() : pick(row, 'Name', 'name', 'Contact Name'))
        const location  = pick(row, 'Location', 'location', 'City', 'city')
        const industry  = pick(row, 'Industry', 'industry', 'Category') || importIndustry
        return {
          id: `imported_${Date.now()}_${i}`,
          name,
          company:  pick(row, 'Company Name', 'Company', 'company', 'Organization', 'org'),
          jobTitle: pick(row, 'Job Title', 'jobTitle', 'Title', 'Designation', 'Role'),
          location,
          state:    pick(row, 'State', 'state') || location,
          industry,
          linkedin: pick(row, 'LinkedIn Profile', 'LinkedIn URL', 'LinkedIn', 'linkedin'),
          email:    pick(row, 'Email ID', 'Email', 'email', 'E-mail', 'EmailID'),
          phone:    pick(row, 'Contact', 'Phone', 'phone', 'Mobile', 'mobile', 'Phone Number'),
          status:   STATUSES.includes(pick(row, 'Status', 'status')) ? pick(row, 'Status', 'status') : 'New',
          notes:    pick(row, 'Notes', 'notes', 'Remarks', 'Comment'),
        }
      }).filter(c => c.name || c.company)

      if (!newContacts.length) throw new Error('No valid rows found')
      setContacts(prev => importMode === 'append' ? [...prev, ...newContacts] : newContacts)
      setImportMsg(`✅ Imported ${newContacts.length} contacts into "${importIndustry}"`)
      setShowImportPanel(false)
    } catch (err) {
      setImportMsg(`❌ Import failed: ${err.message}`)
    }
    setImporting(false)
  }

  const exportCSV = () => {
    const fields  = ['name','company','jobTitle','location','state','industry','linkedin','email','phone','status','notes']
    const headers = ['Name','Company','Job Title','Location','State','Industry','LinkedIn','Email','Phone','Status','Notes']
    const rows = [headers, ...filtered.map(c => fields.map(f => `"${(c[f]||'').replace(/"/g,'""')}"`))]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `mikebags_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  const resetToSample = () => {
    if (confirm('Reset to sample data? This will clear all current contacts.')) setContacts(SAMPLE_DATA)
  }

  const configuredUrls = Object.values(settings.sheetUrls || {}).filter(Boolean).length

  // ── render ─────────────────────────────────────────────────────────────────

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

        <div className="sync-status-bar">
          {settings.autoSync && (
            <span className={`sync-badge ${syncing ? 'syncing' : 'active'}`}>
              {syncing ? '⟳ Syncing...' : `⟳ Auto-Sync ON`}
            </span>
          )}
          {lastSyncTs && (
            <span className="last-sync" key={ticker}>
              Last synced: {formatAgo(lastSyncTs)}
              {syncMsg && <span className="sync-diff"> · {syncMsg}</span>}
            </span>
          )}
        </div>

        <div className="header-right">
          <button
            className={`btn-ghost ${settings.autoSync ? 'sync-on' : ''}`}
            onClick={doSync}
            disabled={syncing || configuredUrls === 0}
            title={configuredUrls === 0 ? 'Add sheet URLs in Settings first' : 'Sync now from all sheets'}
          >
            {syncing ? '⟳ Syncing…' : '⟳ Sync Now'}
          </button>
          <button className="btn-ghost" onClick={() => setShowSettings(true)}>
            ⚙️ Settings {configuredUrls > 0 && <span className="badge-count">{configuredUrls}</span>}
          </button>
          <button className="btn-ghost" onClick={() => setShowImportPanel(!showImportPanel)}>
            📥 Import
          </button>
          <button className="btn-ghost" onClick={exportCSV}>
            📤 Export {filtered.length}
          </button>
          <button className="btn-ghost" onClick={resetToSample} title="Reset to sample data">🔄</button>
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {showImportPanel && (
        <div className="import-panel">
          <div className="import-inner">
            <h3>📥 Import from Google Sheets / CSV URL</h3>
            <p className="import-hint">File → Share → Publish to web → select tab → CSV → copy URL</p>
            <div className="import-row">
              <input type="url" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                className="import-input" />
            </div>
            <div className="import-options">
              <div className="import-option-group">
                <label>Assign to Industry</label>
                <select value={importIndustry} onChange={e => setImportIndustry(e.target.value)}>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div className="import-option-group">
                <label>Import Mode</label>
                <select value={importMode} onChange={e => setImportMode(e.target.value)}>
                  <option value="append">Append to existing</option>
                  <option value="replace">Replace all contacts</option>
                </select>
              </div>
              <button className="btn-accent" onClick={importFromUrl} disabled={importing || !importUrl.trim()}>
                {importing ? 'Importing...' : 'Import'}
              </button>
              <button className="btn-ghost" onClick={() => setShowImportPanel(false)}>Cancel</button>
            </div>
            {importMsg && <div className={`import-msg ${importMsg.startsWith('✅') ? 'success' : 'error'}`}>{importMsg}</div>}
            <div className="import-columns">
              <strong>Columns:</strong> Full Name / First+Last Name, Company Name, Job Title, Location, LinkedIn Profile, Email ID, Contact
            </div>
          </div>
        </div>
      )}

      <div className="stats-row">
        <StatCard label="Total Leads"  value={stats.total}     icon="👥" color="#2979ff" />
        <StatCard label="Contacted"    value={stats.contacted} icon="📞" color="#00bcd4" />
        <StatCard label="Interested"   value={stats.interested} icon="🔥" color="#ffab00" />
        <StatCard label="Deals Closed" value={stats.closed}    icon="🏆" color="#00c853" />
      </div>

      <div className="tabs-bar">
        {TABS.map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
            {tab !== 'All' && (
              <span className="tab-count">{contacts.filter(c => c.industry === tab).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-input"
            placeholder="Search name, company, location, email..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="clear-search" onClick={() => setSearch('')}>×</button>}
        </div>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="filter-select">
          {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
          <option value="All">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
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
              <tr><td colSpan={11} className="empty-state">No contacts found. Adjust filters or import data.</td></tr>
            )}
            {filtered.map((c, idx) => (
              <tr key={c.id} className={`status-row status-${c.status.replace(/\s+/g,'-').toLowerCase()}`}>
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
                  {editingCell === `${c.id}__email`
                    ? <input ref={editRef} className="cell-input" value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(c.id, 'email')}
                        onKeyDown={e => handleEditKeyDown(e, c.id, 'email')} />
                    : <span className="editable-cell" onClick={() => startEdit(c.id, 'email', c.email)}>
                        {c.email || <span className="text-muted add-hint">+ Add</span>}
                      </span>}
                </td>
                <td>
                  {editingCell === `${c.id}__phone`
                    ? <input ref={editRef} className="cell-input" value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(c.id, 'phone')}
                        onKeyDown={e => handleEditKeyDown(e, c.id, 'phone')} />
                    : <span className="editable-cell" onClick={() => startEdit(c.id, 'phone', c.phone)}>
                        {c.phone || <span className="text-muted add-hint">+ Add</span>}
                      </span>}
                </td>
                <td>
                  <select className="status-select"
                    style={{ borderColor: STATUS_COLORS[c.status], color: STATUS_COLORS[c.status] }}
                    value={c.status} onChange={e => updateContact(c.id, 'status', e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <button className="notes-btn" onClick={() => setNotesModal(c)} title={c.notes || 'Add notes'}>
                    {c.notes ? '📝' : '+ Note'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notesModal && (
        <NotesModal
          contact={notesModal}
          onSave={notes => { updateContact(notesModal.id, 'notes', notes); setNotesModal(null) }}
          onClose={() => setNotesModal(null)}
        />
      )}

      {showSettings && (
        <Settings
          settings={settings}
          onSave={s => { setSettings(s); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-icon" style={{ color }}>{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function NotesModal({ contact, onSave, onClose }) {
  const [text, setText] = useState(contact.notes || '')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📝 Notes — {contact.name}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <textarea className="notes-textarea" value={text} onChange={e => setText(e.target.value)}
          placeholder="Add notes about this contact..." autoFocus rows={6} />
        <div className="modal-actions">
          <button className="btn-accent" onClick={() => onSave(text)}>Save Notes</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
