import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getToken, getUser, logout } from '../auth'

const API = import.meta.env.VITE_API_URL || '/api'

const HAUTEURS = [
  { label: '3,5 m (plain-pied)', value: 3.5 },
  { label: '7,0 m (deux niveaux)', value: 7.0 },
]

const ORIENTATIONS = [
  { label: 'Nord', value: 2 },
  { label: 'Est',  value: 3 },
  { label: 'Sud',  value: 4 },
  { label: 'Ouest', value: 5 },
]

const VITRAGES = [
  { label: '0 % (pas de vitrage)',  value: 0.0 },
  { label: '10 % de la surface',    value: 0.1 },
  { label: '25 % de la surface',    value: 0.25 },
  { label: '40 % de la surface',    value: 0.4 },
]

const DISTRIBUTIONS = [
  { label: '0 — Uniforme',          value: 0 },
  { label: '1 — Nord uniquement',   value: 1 },
  { label: '2 — Est uniquement',    value: 2 },
  { label: '3 — Sud uniquement',    value: 3 },
  { label: '4 — Ouest uniquement',  value: 4 },
  { label: '5 — Réparti',           value: 5 },
]

const DEFAULT_FORM = {
  nom: '',
  compacite: 0.98,
  surface_totale: 514.5,
  surface_murs: 294.0,
  surface_toit: 110.25,
  hauteur: 7.0,
  orientation: 4,
  surface_vitrage: 0.25,
  distribution_vitrage: 0,
}

export default function PublicForm() {
  const navigate = useNavigate()
  const user = getUser()
  const [step, setStep] = useState('form')
  const [health, setHealth] = useState('checking')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('down'))
  }, [])

  const updateField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setStep('loading')

    const features = [
      form.compacite,
      form.surface_totale,
      form.surface_murs,
      form.surface_toit,
      form.hauteur,
      form.orientation,
      form.surface_vitrage,
      form.distribution_vitrage,
    ]

    try {
      const r = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ features, applicant_name: form.nom }),
      })
      if (r.status === 401 || r.status === 403) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setResult(data)
      setStep('result')
    } catch (err) {
      setError(err.message)
      setStep('form')
    }
  }

  const reset = () => { setStep('form'); setResult(null); setError(null) }
  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">⚡</div>
            <div>
              <div className="brand-name">EnergyScore</div>
              <div className="brand-sub">Prédiction de charge énergétique bâtiment</div>
            </div>
          </div>
          <div className="header-right">
            <div className={`health health-${health}`}>
              <span className="health-dot" />
              {health === 'ok' ? 'En ligne' : health === 'down' ? 'Indisponible' : 'Connexion...'}
            </div>
            {user?.role === 'admin' && (
              <Link to="/admin" className="admin-link">Espace admin →</Link>
            )}
            <div className="header-user">
              <span>{user?.name || user?.email}</span>
              <button type="button" onClick={handleLogout} className="header-logout">
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {step === 'form'    && <FormPanel form={form} updateField={updateField} submit={submit} error={error} />}
        {step === 'loading' && <LoadingPanel />}
        {step === 'result'  && result && <ResultPanel form={form} result={result} reset={reset} />}
      </main>

      <footer className="footer">
        Démo pédagogique — Master IA 2iE — Dataset UCI Energy Efficiency (768 bâtiments simulés).
      </footer>
    </div>
  )
}

function FormPanel({ form, updateField, submit, error }) {
  return (
    <form onSubmit={submit} className="card">
      <div className="card-header">
        <h1>Analyse énergétique d'un bâtiment</h1>
        <p>Renseignez les caractéristiques architecturales pour estimer la charge de chauffage (kWh/m²).</p>
      </div>

      <section className="section">
        <h2>Identification</h2>
        <div className="grid">
          <Field label="Référence du bâtiment">
            <input
              type="text"
              value={form.nom}
              onChange={(e) => updateField('nom', e.target.value)}
              placeholder="Ex. Bâtiment B3 — Ouagadougou"
              required
            />
          </Field>
        </div>
      </section>

      <section className="section">
        <h2>Géométrie</h2>
        <div className="grid">
          <Field label="Compacité relative (0,62 – 0,98)">
            <input
              type="number" min="0.62" max="0.98" step="0.01"
              value={form.compacite}
              onChange={(e) => updateField('compacite', parseFloat(e.target.value))}
              required
            />
          </Field>
          <Field label="Surface totale (m²)">
            <input
              type="number" min="400" max="900" step="0.5"
              value={form.surface_totale}
              onChange={(e) => updateField('surface_totale', parseFloat(e.target.value))}
              required
            />
          </Field>
          <Field label="Surface des murs (m²)">
            <input
              type="number" min="200" max="450" step="0.5"
              value={form.surface_murs}
              onChange={(e) => updateField('surface_murs', parseFloat(e.target.value))}
              required
            />
          </Field>
          <Field label="Surface du toit (m²)">
            <input
              type="number" min="100" max="250" step="0.25"
              value={form.surface_toit}
              onChange={(e) => updateField('surface_toit', parseFloat(e.target.value))}
              required
            />
          </Field>
          <Select
            label="Hauteur du bâtiment"
            value={form.hauteur}
            options={HAUTEURS}
            onChange={(v) => updateField('hauteur', v)}
          />
        </div>
      </section>

      <section className="section">
        <h2>Vitrage & Orientation</h2>
        <div className="grid">
          <Select
            label="Orientation principale"
            value={form.orientation}
            options={ORIENTATIONS}
            onChange={(v) => updateField('orientation', v)}
          />
          <Select
            label="Surface de vitrage"
            value={form.surface_vitrage}
            options={VITRAGES}
            onChange={(v) => updateField('surface_vitrage', v)}
          />
          <Select
            label="Distribution du vitrage"
            value={form.distribution_vitrage}
            options={DISTRIBUTIONS}
            onChange={(v) => updateField('distribution_vitrage', v)}
          />
        </div>
      </section>

      {error && <div className="error">Erreur : {error}</div>}

      <div className="actions">
        <button type="submit" className="btn-primary">
          Estimer la charge énergétique
        </button>
      </div>
    </form>
  )
}

function LoadingPanel() {
  return (
    <div className="card loading">
      <div className="spinner" />
      <h2>Analyse en cours</h2>
      <p>Calcul de la charge de chauffage basé sur le profil architectural.</p>
    </div>
  )
}

function ResultPanel({ form, result, reset }) {
  const charge = parseFloat(result.prediction)
  const classe = charge < 15 ? 'A' : charge < 25 ? 'B' : charge < 35 ? 'C' : 'D'
  const classeLabel = { A: 'Très basse', B: 'Basse', C: 'Modérée', D: 'Élevée' }[classe]
  const bon = charge < 25

  return (
    <div className="card result">
      <div className={`badge ${bon ? 'badge-ok' : 'badge-ko'}`}>
        {bon ? '✓ Consommation maîtrisée' : '⚠ Consommation élevée'}
      </div>

      <h1>Résultat pour {form.nom || 'le bâtiment'}</h1>

      <div className="metrics">
        <Metric label="Charge chauffage" value={charge.toFixed(1)} suffix=" kWh/m²" />
        <Metric label="Classe énergie"   value={classe} />
        <Metric label="Niveau"           value={classeLabel} />
        <Metric label="Hauteur"          value={form.hauteur} suffix=" m" />
      </div>

      <div className="recommendation">
        <h3>Interprétation</h3>
        <p>
          {bon
            ? `Le bâtiment présente une charge de chauffage de ${charge.toFixed(1)} kWh/m², en dessous du seuil de 25 kWh/m². L'enveloppe thermique est bien dimensionnée.`
            : `La charge de chauffage de ${charge.toFixed(1)} kWh/m² est élevée. Des améliorations de l'isolation ou du vitrage sont recommandées pour réduire la consommation.`
          }
        </p>
        <p className="note">
          Modèle entraîné sur le dataset UCI Energy Efficiency (768 bâtiments). Résultat indicatif.
        </p>
      </div>

      <div className="actions">
        <button onClick={reset} className="btn-secondary">
          Nouveau bâtiment
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
}

function Metric({ label, value, suffix = '' }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}<span className="metric-suffix">{suffix}</span></div>
    </div>
  )
}
