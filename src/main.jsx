import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginPage from './components/LoginPage.jsx'
import { useAuth } from './hooks/useAuth.js'

function Root() {
  const { isAuthenticated, login, logout, loading, error } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} loading={loading} error={error} />
  }

  return <App onLogout={logout} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
