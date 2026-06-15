import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicForm from './pages/PublicForm.jsx'
import AdminLayout from './pages/AdminLayout.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminPredictions from './pages/AdminPredictions.jsx'
import { isAdmin, isAuthenticated } from './auth.js'
import './App.css'

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login?next=/admin" replace />
  if (!isAdmin()) return <Navigate to="/" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <PublicForm />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/admin/login" element={<Navigate to="/login?next=/admin" replace />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="predictions" element={<AdminPredictions />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
