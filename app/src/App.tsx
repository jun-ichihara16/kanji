import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import EventCreate from './pages/EventCreate'
import EventManage from './pages/EventManage'
import GuestJoin from './pages/GuestJoin'
import AuthCallback from './pages/AuthCallback'
import Onboarding from './pages/Onboarding'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminEvents from './pages/admin/AdminEvents'
import AdminVenues from './pages/admin/AdminVenues'
import AdminInquiries from './pages/admin/AdminInquiries'

export default function App() {
  return (
    <Routes>
      {/* Admin routes (separate layout) */}
      <Route path="/admin" element={
        <AdminProtectedRoute>
          <div className="flex justify-center min-h-screen bg-gray-bg">
            <div className="w-full max-w-[800px] min-h-screen bg-white shadow-[0_0_40px_rgba(0,0,0,0.08)] flex flex-col">
              <AdminLayout />
            </div>
          </div>
        </AdminProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="venues" element={<AdminVenues />} />
        <Route path="inquiries" element={<AdminInquiries />} />
      </Route>

      {/* App routes */}
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/events/new" element={<ProtectedRoute><EventCreate /></ProtectedRoute>} />
            <Route path="/events/:id" element={<ProtectedRoute><EventManage /></ProtectedRoute>} />
            <Route path="/e/:slug" element={<GuestJoin />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}
