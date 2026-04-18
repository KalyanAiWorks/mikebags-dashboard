import React, { useState } from 'react'
import { INDUSTRIES } from '../config'
import './Settings.css'

export default function Settings({ settings, onSave, onClose }) {
  const [urls, setUrls] = useState(settings.sheetUrls || {})
  const [autoSync, setAutoSync] = useState(settings.autoSync !== undefined ? settings.autoSync : true)
  const [interval, setInterval] = useState(settings.syncInterval || 60)

  const setUrl = (industry, val) => setUrls(prev => ({ ...prev, [industry]: val }))

  const configuredCount = Object.values(urls).filter(Boolean).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ Auto-Sync Settings</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <div className="settings-row">
              <div className="toggle-group">
                <label className="toggle-label">
                  <span>Auto-Sync</span>
                  <span className="toggle-sub">Poll sheets every {interval}s, update email & phone automatically</span>
                </label>
                <button
                  className={`toggle-btn ${autoSync ? 'on' : 'off'}`}
                  onClick={() => setAutoSync(!autoSync)}
                >
                  {autoSync ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div className="settings-row">
              <label className="field-label">Poll interval (seconds)</label>
              <select value={interval} onChange={e => setInterval(Number(e.target.value))} className="interval-select">
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-title">
              Google Sheets CSV URLs
              <span className="section-sub">({configuredCount}/{INDUSTRIES.length} configured)</span>
            </div>
            <p className="section-hint">
              For each sheet tab: File → Share → Publish to web → select sheet tab → CSV → Publish. Paste URL below.
            </p>
            <div className="url-list">
              {INDUSTRIES.map(ind => (
                <div key={ind} className="url-row">
                  <label className="url-label">
                    <span className={`url-dot ${urls[ind] ? 'active' : ''}`} />
                    {ind}
                  </label>
                  <input
                    type="url"
                    className="url-input"
                    value={urls[ind] || ''}
                    onChange={e => setUrl(ind, e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-accent" onClick={() => onSave({ sheetUrls: urls, autoSync, syncInterval: interval })}>
            Save Settings
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
