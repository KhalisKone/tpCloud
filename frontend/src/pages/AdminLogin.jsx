import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isAuthenticated, setSession } from '../auth'

const API = import.meta.env.VITE_API_URL || '/api'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function AdminLogin() {
  const buttonRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(next || '/', { replace: true })
      return
    }

    if (!GOOGLE_CLIENT_ID) {
      setError("VITE_GOOGLE_CLIENT_ID n'est pas configuré (voir .env).")
      return
    }

    const tryRender = () => {
      if (!window.google?.accounts?.id) return false
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
        locale: 'fr',
      })
      return true
    }

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval)
      }, 200)
      return () => clearInterval(interval)
    }
  }, [navigate, next])

  const handleCredential = async (response) => {
    setError(null)
    setLoading(true)
    try {
      const r = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
      const text = await r.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { detail: text || 'Réponse serveur invalide.' }
      }
      if (!r.ok) {
        setError(data.detail || `Erreur ${r.status}`)
        return
      }
      setSession(data.token, data.user)
      const target = next?.startsWith('/admin') && data.user.role !== 'admin' ? '/' : next || '/'
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">μ</div>
          <div>
            <div className="brand-name">MicroScore</div>
            <div className="brand-sub">Accès sécurisé</div>
          </div>
        </div>

        <p className="login-intro">
          Connectez-vous avec votre compte Google pour accéder à l'application.
        </p>

        <div className="google-btn-wrap" ref={buttonRef} />

        {loading && <div className="login-status">Vérification...</div>}
        {error && <div className="error">{error}</div>}

        <p className="login-hint">
          Les emails listés dans <code>ADMIN_EMAILS</code> obtiennent aussi l'accès administrateur.
        </p>
      </div>
    </div>
  )
}
