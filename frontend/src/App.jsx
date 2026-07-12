import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import LoadingScreen from './components/LoadingScreen'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Servers from './pages/Servers'
import Logs from './pages/Logs'
import Alerts from './pages/Alerts'
import Chat from './pages/Chat'
import Integrations from './pages/Integrations'
import ApiDocs from './pages/ApiDocs'
import Settings from './pages/Settings'
import Architecture from './pages/Architecture'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen message="Authenticating..." />
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return children
}

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    className="h-full"
  >
    {children}
  </motion.div>
)

export default function App() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={isAuthenticated ? <Navigate to="/architecture" replace /> : <Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/architecture" element={<ProtectedRoute><PageTransition><Architecture /></PageTransition></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><PageTransition><Analytics /></PageTransition></ProtectedRoute>} />
        <Route path="/servers" element={<ProtectedRoute><PageTransition><Servers /></PageTransition></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><PageTransition><Logs /></PageTransition></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><PageTransition><Alerts /></PageTransition></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><PageTransition><Chat /></PageTransition></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute><PageTransition><Integrations /></PageTransition></ProtectedRoute>} />
        <Route path="/docs" element={<ProtectedRoute><PageTransition><ApiDocs /></PageTransition></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/signup" element={<Navigate to="/auth" replace />} />
        <Route path="/" element={isAuthenticated ? <Navigate to="/architecture" replace /> : <Navigate to="/auth" replace />} />
        <Route path="*" element={isAuthenticated ? <Navigate to="/architecture" replace /> : <Navigate to="/auth" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
