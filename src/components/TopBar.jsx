import { useState, useEffect } from 'react'

const SOURCE_FILTERS = [
  { src: 'all',          label: 'All' },
  { src: 'dine-in',      label: '🍽 Dine In' },
  { src: 'pos-takeaway', label: '🛍 POS Takeaway' },
  { src: 'pos-delivery', label: '🛵 POS Delivery' },
  { src: 'web-takeaway', label: '🌐 Web Takeaway' },
  { src: 'web-delivery', label: '🌐 Web Delivery' },
  { src: 'uber',         label: '🟢 Uber Eats' },
  { src: 'ai-order',     label: '🤖 AI Orders' },
]

export default function TopBar({ activeTab, activeSrc, openCount, doneCount, onSwitchTab, onFilterSrc }) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const h   = now.getHours()
      const m   = String(now.getMinutes()).padStart(2, '0')
      const ap  = h >= 12 ? 'PM' : 'AM'
      const h12 = String(h % 12 || 12).padStart(2, '0')
      setClock(`${h12}:${m} ${ap}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="topbar">
      <img
        src="/orderart-logo.png"
        alt="OrderArt"
        style={{ height: 24, width: 'auto', flexShrink: 0, objectFit: 'contain' }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', flexShrink: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
        KDS
      </span>

      <div className="vsep" />

      <div className="tab-group">
        <button
          className={`tab${activeTab === 'open' ? ' active' : ''}`}
          onClick={() => onSwitchTab('open')}
        >
          Open <span className="badge">{openCount}</span>
        </button>
        <button
          className={`tab${activeTab === 'completed' ? ' active' : ''}`}
          onClick={() => onSwitchTab('completed')}
        >
          Completed <span className="badge">{doneCount}</span>
        </button>
      </div>

      <div className="vsep" />

      <div className="src-filters">
        {SOURCE_FILTERS.map(({ src, label }) => (
          <button
            key={src}
            className={`sf${activeSrc === src ? ' active' : ''}`}
            onClick={() => onFilterSrc(src)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="spacer" />
      <div className="clock">{clock}</div>
    </div>
  )
}
