import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/admin', label: 'ダッシュボード', icon: '📊' },
  { to: '/admin/users', label: 'ユーザー管理', icon: '👥' },
  { to: '/admin/events', label: 'イベント監視', icon: '📅' },
  { to: '/admin/venues', label: '提携店舗', icon: '🏪' },
  { to: '/admin/inquiries', label: 'お問い合わせ', icon: '📩' },
]

export default function AdminLayout() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="bg-[#1A1A1A] text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-bold">AI KANJI Admin</span>
        <a href="/app/dashboard" className="text-xs text-gray-400 hover:text-white">← アプリに戻る</a>
      </div>
      {/* Horizontal nav (mobile-friendly) */}
      <nav className="bg-white border-b border-border overflow-x-auto flex">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/admin'}
            className={({ isActive }) =>
              `shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                isActive ? 'text-green border-green' : 'text-sub border-transparent'
              }`
            }
          >
            {n.icon} {n.label}
          </NavLink>
        ))}
      </nav>
      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-bg">
        <Outlet />
      </div>
    </div>
  )
}
