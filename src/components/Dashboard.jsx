import React, { useState, useEffect, useMemo, useRef } from 'react'
import Papa from 'papaparse'
import './Dashboard.css'

const STORAGE_KEY = 'mb_contacts_v2'
const LAST_IMPORT_KEY = 'mb_last_import'

const INDUSTRIES = [
  'All',
  'Education Schools',
  'Education Colleges',
  'Corporate IT',
  'Corporate FMCG',
  'Corporate Large',
  'Gifting Events',
  'Sports Gyms',
]

const STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Meeting Scheduled',
  'Deal Closed',
  'Not Interested',
]

const STATUS_COLORS = {
  'New': '#2979ff',
  'Contacted': '#00bcd4',
  'Interested': '#ffab00',
  'Meeting Scheduled': '#7c4dff',
  'Deal Closed': '#00c853',
  'Not Interested': '#ff4444',
}

const INDIAN_STATES = [
  'All States',
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow',
]

const SAMPLE_DATA = [
  { id: '1', name: 'Rajesh Kumar', company: 'Delhi Public School', jobTitle: 'Principal', location: 'Delhi', state: 'Delhi', industry: 'Education Schools', linkedin: 'https://linkedin.com/in/rajeshkumar', email: 'principal@dps.edu', phone: '+91 98765 43210', status: 'New', notes: '' },
  { id: '2', name: 'Priya Sharma', company: 'IIT Bombay', jobTitle: 'Admin Head', location: 'Mumbai', state: 'Mumbai', industry: 'Education Colleges', linkedin: 'https://linkedin.com/in/priyasharma', email: 'admin@iitb.ac.in', phone: '+91 87654 32109', status: 'Contacted', notes: 'Called on Monday, follow up needed' },
  { id: '3', name: 'Vikram Patel', company: 'Infosys Ltd', jobTitle: 'HR Director', location: 'Bangalore', state: 'Bangalore', industry: 'Corporate IT', linkedin: 'https://linkedin.com/in/vikrampatel', email: 'hr@infosys.com', phone: '+91 76543 21098', status: 'Interested', notes: 'Interested in bulk order for 500 bags' },
  { id: '4', name: 'Anita Desai', company: 'HUL India', jobTitle: 'Procurement Manager', location: 'Mumbai', state: 'Mumbai', industry: 'Corporate FMCG', linkedin: 'https://linkedin.com/in/anitadesai', email: 'procurement@hul.com', phone: '+91 65432 10987', status: 'Meeting Scheduled', notes: 'Meeting on Friday 3pm' },
  { id: '5', name: 'Suresh Menon', company: 'Tata Consultancy', jobTitle: 'Operations Head', location: 'Chennai', state: 'Chennai', industry: 'Corporate Large', linkedin: 'https://linkedin.com/in/sureshmenon', email: 'ops@tcs.com', phone: '+91 54321 09876', status: 'Deal Closed', notes: 'Order confirmed: 200 laptop bags' },
  { id: '6', name: 'Meera Nair', company: 'EventPro India', jobTitle: 'Event Director', location: 'Hyderabad', state: 'Hyderabad', industry: 'Gifting Events', linkedin: 'https://linkedin.com/in/meeranair', email: 'events@eventpro.in', phone: '+91 43210 98765', status: 'Interested', notes: 'Looking for branded bags for corporate events' },
  { id: '7', name: 'Arjun Singh', company: 'FitZone Gyms', jobTitle: 'Brand Manager', location: 'Pune', state: 'Pune', industry: 'Sports Gyms', linkedin: 'https://linkedin.com/in/arjunsingh', email: 'brand@fitzone.in', phone: '+91 32109 87654', status: 'Not Interested', notes: 'Budget constraints this quarter' },
  { id: '8', name: 'Kavita Reddy', company: 'Ryan International', jobTitle: 'Purchase Head', location: 'Hyderabad', state: 'Hyderabad', industry: 'Education Schools', linkedin: 'https://linkedin.com/in/kavitareddy', email: 'purchase@ryan.edu', phone: '+91 21098 76543', status: 'Contacted', notes: 'Sent catalog, awaiting reply' },
  { id: '9', name: 'Rohit Malhotra', company: 'Wipro Technologies', jobTitle: 'Admin Manager', location: 'Bangalore', state: 'Bangalore', industry: 'Corporate IT', linkedin: 'https://linkedin.com/in/rohitmalhotra', email: 'admin@wipro.com', phone: '+91 19876 54321', status: 'New', notes: '' },
  { id: '10', name: 'Sunita Joshi', company: 'Amity University', jobTitle: 'Dean', location: 'Noida', state: 'Uttar Pradesh', industry: 'Education Colleges', linkedin: 'https://linkedin.com/in/sunitajoshi', email: 'dean@amity.edu', phone: '+91 98761 23456', status: 'Interested', notes: 'Wants customized bags with university logo' },
]

function loadContacts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : SAMPLE_DATA
  } catch {
    return SAMPLE_DATA
  }
}

function saveContacts(contacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

export default function Dashboard({ onLogout }) {
  const [contacts, setContacts] = useState(loadContacts)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('All States')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [notesModal, setNotesModal] = useState(null)
  const editRef = useRef(null)

  useEffect(() => { saveContacts(contacts) }, [contacts])

  useEffect(() => {
    if (editingCell && editRef.current) editRef.current.focus()
  }, [editingCell])

  const updateContact = (id, field, value) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const filtered = useMemo(() => {
    return contacts.filter(c => {
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
    })
  }, [contacts, activeTab, stateFilter, statusFilter, search])

  const stats = useMemo(() => {
    const base = activeTab === 'All' ? contacts : contacts.filter(c => c.industry === activeTab)
    return {
      total: base.length,
      contacted: base.filter(c => ['Contacted', 'Interested', 'Meeting Scheduled', 'Deal Closed'].includes(c.status)).length,
      interested: base.filter(c => ['Interested', 'Meeting Scheduled'].includes(c.status)).length,
      closed: base.filter(c => c.status === 'Deal Closed').length,
    }
  }, [contacts, activeTab])

  const startEdit = (id, field, value) => {
    setEditingCell(`${id}__${field}`)
    setEditValue(value || '')
  }

  const commitEdit = (id, field) => {
    updateContact(id, field, editValue)
    setEditingCell(null)
  }

  const handleEditKeyDown = (e, id, field) => {
    if (e.key === 'Enter') commitEdit(id, field)
    if (e.key === 'Escape') setEditingCell(null)
  }

  const importFromUrl = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportMsg('')
    try {
      const url = importUrl.includes('output=csv') ? importUrl : importUrl + (importUrl.includes('?') ? '&' : '?') + 'output=csv'
      const res = await fetch(url)
      const text = await res.text()
      const result = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (result.errors.length && !result.data.length) throw new Error('Parse failed')
      const newContacts = result.data.map((row, i) => ({
        id: `imported_${Date.now()}_${i}`,
        name: row['Name'] || row['name'] || row['Contact Name'] || '',
        company: row['Company'] || row['company'] || row['Organization'] || '',
        jobTitle: row['Job Title'] || row['jobTitle'] || row['Title'] || row['Designation'] || '',
        location: row['Location'] || row['location'] || row['City'] || '',
        state: row['State'] || row['state'] || row['Location'] || '',
        industry: row['Industry'] || row['industry'] || row['Category'] || 'Corporate IT',
        linkedin: row['LinkedIn'] || row['linkedin'] || row['LinkedIn URL'] || '',
        email: row['Email'] || row['email'] || '',
        phone: row['Phone'] || row['phone'] || row['Mobile'] || '',
        status: STATUSES.includes(row['Status'] || row['status']) ? (row['Status'] || row['status']) : 'New',
        notes: row['Notes'] || row['notes'] || '',
      })).filter(c => c.name || c.company)
      if (!newContacts.length) throw new Error('No valid rows found')
      setContacts(newContacts)
      localStorage.setItem(LAST_IMPORT_KEY, new Date().toLocaleString())
      setImportMsg(`✅ Imported ${newContacts.length} contacts successfully!`)
      setShowImportPanel(false)
    } catch (err) {
      setImportMsg(`❌ Import failed: ${err.message}`)
    }
    setImporting(false)
  }

  const exportCSV = () => {
    const fields = ['name', 'company', 'jobTitle', 'location', 'state', 'industry', 'linkedin', 'email', 'phone', 'status', 'notes']
    const headers = ['Name', 'Company', 'Job Title', 'Location', 'State', 'Industry', 'LinkedIn', 'Email', 'Phone', 'Status', 'Notes']
    const rows = [headers, ...filtered.map(c => fields.map(f => `"${(c[f] || '').replace(/"/g, '""')}"`))]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mikebags_leads_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const resetToSample = () => {
    if (confirm('Reset to sample data? This will clear all current contacts.')) {
      setContacts(SAMPLE_DATA)
    }
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
        <div className="header-right">
          <button className="btn-ghost" onClick={() => setShowImportPanel(!showImportPanel)}>
            📥 Import CSV
          </button>
          <button className="btn-ghost" onClick={exportCSV}>
            📤 Export {filtered.length}
          </button>
          <button className="btn-ghost" onClick={resetToSample} title="Reset to sample data">
            🔄 Reset
          </button>
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {showImportPanel && (
        <div className="import-panel">
          <div className="import-inner">
            <h3>📥 Import from Google Sheets / CSV URL</h3>
            <p className="import-hint">Publish sheet as CSV: File → Share → Publish to web → CSV format</p>
            <div className="import-row">
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                className="import-input"
              />
              <button className="btn-accent" onClick={importFromUrl} disabled={importing || !importUrl.trim()}>
                {importing ? 'Importing...' : 'Import'}
              </button>
              <button className="btn-ghost" onClick={() => setShowImportPanel(false)}>Cancel</button>
            </div>
            {importMsg && <div className={`import-msg ${importMsg.startsWith('✅') ? 'success' : 'error'}`}>{importMsg}</div>}
            <div className="import-columns">
              <strong>Expected CSV columns:</strong> Name, Company, Job Title, Location, State, Industry, LinkedIn, Email, Phone, Status, Notes
            </div>
          </div>
        </div>
      )}

      <div className="stats-row">
        <StatCard label="Total Leads" value={stats.total} icon="👥" color="#2979ff" />
        <StatCard label="Contacted" value={stats.contacted} icon="📞" color="#00bcd4" />
        <StatCard label="Interested" value={stats.interested} icon="🔥" color="#ffab00" />
        <StatCard label="Deals Closed" value={stats.closed} icon="🏆" color="#00c853" />
      </div>

      <div className="tabs-bar">
        {INDUSTRIES.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab !== 'All' && (
              <span className="tab-count">
                {contacts.filter(c => c.industry === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search name, company, location, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search" onClick={() => setSearch('')}>×</button>
          )}
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
              <th>#</th>
              <th>Name</th>
              <th>Company</th>
              <th>Job Title</th>
              <th>Location</th>
              <th>Industry</th>
              <th>LinkedIn</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="empty-state">
                  No contacts found. Try adjusting filters or import data.
                </td>
              </tr>
            )}
            {filtered.map((c, idx) => (
              <tr key={c.id} className={`status-row status-${c.status.replace(/\s+/g, '-').toLowerCase()}`}>
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
                  {c.linkedin ? (
                    <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="link-btn">
                      LinkedIn →
                    </a>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td>
                  {editingCell === `${c.id}__email` ? (
                    <input
                      ref={editRef}
                      className="cell-input"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(c.id, 'email')}
                      onKeyDown={e => handleEditKeyDown(e, c.id, 'email')}
                    />
                  ) : (
                    <span className="editable-cell" onClick={() => startEdit(c.id, 'email', c.email)}>
                      {c.email || <span className="text-muted add-hint">+ Add</span>}
                    </span>
                  )}
                </td>
                <td>
                  {editingCell === `${c.id}__phone` ? (
                    <input
                      ref={editRef}
                      className="cell-input"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(c.id, 'phone')}
                      onKeyDown={e => handleEditKeyDown(e, c.id, 'phone')}
                    />
                  ) : (
                    <span className="editable-cell" onClick={() => startEdit(c.id, 'phone', c.phone)}>
                      {c.phone || <span className="text-muted add-hint">+ Add</span>}
                    </span>
                  )}
                </td>
                <td>
                  <select
                    className="status-select"
                    style={{ borderColor: STATUS_COLORS[c.status], color: STATUS_COLORS[c.status] }}
                    value={c.status}
                    onChange={e => updateContact(c.id, 'status', e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <button
                    className="notes-btn"
                    onClick={() => setNotesModal(c)}
                    title={c.notes || 'Add notes'}
                  >
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
          onSave={(notes) => {
            updateContact(notesModal.id, 'notes', notes)
            setNotesModal(null)
          }}
          onClose={() => setNotesModal(null)}
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
        <textarea
          className="notes-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add notes about this contact..."
          autoFocus
          rows={6}
        />
        <div className="modal-actions">
          <button className="btn-accent" onClick={() => onSave(text)}>Save Notes</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
