import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, token } = useAuth()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect non-admins trying to access /admin back to /chat
    return <Navigate to="/chat" replace />
  }

  return children
}
