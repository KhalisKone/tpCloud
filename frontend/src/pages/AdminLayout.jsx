import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getUser, logout } from '../auth'

export default function AdminLayout() {
  const navigate = useNavigate()
  const user = getUser()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="admin">
      <aside className="sidebar">
        <Link to="/" className="sidebar-brand">
          <div className="brand-mark sm">μ</div>
          <div className="brand-name">MicroScore</div>
        </Link>

        <nav className="sidebar-nav">
          <NavLink to="/admin" end className="nav-item">
            <span className="nav-icon">▣</span> Tableau de bord
          </NavLink>
          <NavLink to="/admin/predictions" className="nav-item">
            <span className="nav-icon">≡</span> Demandes
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            {user?.picture ? (
              <img src={user.picture} alt="" className="user-avatar-img" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar">{initials}</div>
            )}
            <div className="user-info">
              <div className="user-name">{user?.name || 'Administrateur'}</div>
              <div className="user-role">{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn" title="Déconnexion">
            ↪ Déconnexion
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}
