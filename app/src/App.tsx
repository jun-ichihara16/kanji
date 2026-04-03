import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import EventCreate from './pages/EventCreate'
import EventManage from './pages/EventManage'
import GuestJoin from './pages/GuestJoin'
import AuthCallback from './pages/AuthCallback'
import Onboarding from './pages/Onboarding'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <ProtectedRoute>
              <EventCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventManage />
            </ProtectedRoute>
          }
        />
        <Route path="/e/:slug" element={<GuestJoin />} />
      </Routes>
    </Layout>
  )
}
