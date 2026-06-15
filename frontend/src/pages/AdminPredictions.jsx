import { useEffect, useState } from 'react'
import { adminFetch } from '../auth'

const API = import.meta.env.VITE_API_URL || '/api'

const ACCEPTED_LABELS = new Set(['accordé', 'accorde', 'accepted', 'approved', '1', 'versicolor', 'virginica'])

function isAccepted(prediction) {
  return ACCEPTED_LABELS.has(String(prediction).toLowerCase())
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminPredictions() {
  const [predictions, setPredictions] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    adminFetch(`${API}/admin/predictions?limit=100`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setPredictions)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="dash">
        <div className="empty">Erreur de chargement : {error}</div>
      </div>
    )
  }
  if (predictions === null) {
    return (
      <div className="dash">
        <div className="empty">Chargement...</div>
      </div>
    )
  }

  const filtered = predictions.filter((p) => {
    const matchQuery = query === '' || (p.applicant_name || '').toLowerCase().includes(query.toLowerCase())
    const accepted = isAccepted(p.prediction)
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'Accordé' && accepted) ||
      (statusFilter === 'Refusé' && !accepted)
    return matchQuery && matchStatus
  })

  return (
    <div className="dash">
      <div className="dash-header">
        <h1>Demandes</h1>
        <p>Historique des évaluations de crédit. {filtered.length} résultat{filtered.length > 1 ? 's' : ''}.</p>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Rechercher par nom..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="all">Tous les statuts</option>
          <option value="Accordé">Accordé</option>
          <option value="Refusé">Refusé</option>
        </select>
      </div>

      <div className="dash-card no-pad">
        {filtered.length === 0 ? (
          <div className="empty">
            {predictions.length === 0
              ? 'Aucune demande pour l\'instant. Soumettez-en une depuis le formulaire.'
              : 'Aucune demande ne correspond à votre recherche.'}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Demandeur</th>
                <th>Montant</th>
                <th>Score</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const accepted = isAccepted(p.prediction)
                return (
                  <tr key={p.id}>
                    <td className="mono">#{p.id}</td>
                    <td>{p.applicant_name || <span className="muted">Anonyme</span>}</td>
                    <td>{p.amount ? `${p.amount.toLocaleString('fr-FR')} FCFA` : '—'}</td>
                    <td>
                      {p.score !== null && p.score !== undefined ? (
                        <div className="score-bar">
                          <span className="score-bar-fill" style={{ width: `${p.score / 10}%` }} />
                          <span className="score-bar-text">{p.score}</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${accepted ? 'pill-ok' : 'pill-ko'}`}>
                        {accepted ? 'Accordé' : 'Refusé'}
                      </span>
                    </td>
                    <td className="muted">{formatDate(p.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
