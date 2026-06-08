import { useState } from 'react'

export default function LoginPage({ onLogin, loading, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    onLogin(username.trim(), password)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img
            src="/orderart-logo.png"
            alt="OrderArt"
            className="login-logo-img"
            onError={e => { e.target.style.display = 'none' }}
          />
          <span className="login-logo-text">
            Order<span className="login-logo-art">Art</span>
            <span className="login-logo-kds">KDS</span>
          </span>
        </div>

        <p className="login-tagline">Kitchen Display System</p>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          <div className="login-field">
            <label className="login-label" htmlFor="kds-email">Email</label>
            <input
              id="kds-email"
              className="login-input"
              type="email"
              placeholder="you@restaurant.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="kds-password">Password</label>
            <div className="login-pwd-wrap">
              <input
                id="kds-password"
                className="login-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPwd(p => !p)}
                tabIndex={-1}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
