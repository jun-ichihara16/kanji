import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/auth'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, displayName } = useAuth()

  return (
    <div className="flex justify-center min-h-screen bg-gray-bg">
      <div className="w-full max-w-[390px] min-h-screen bg-white shadow-[0_0_40px_rgba(0,0,0,0.08)] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-white sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-1.5 text-xl font-extrabold text-green">
            <img src="/app/img/kanji_logo.png" alt="" width={26} height={26} />
            AI KANJI
          </Link>
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sub">{displayName}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-sub hover:text-red-500 transition"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-sub bg-gray-bg px-2 py-0.5 rounded-full">
              β版
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    </div>
  )
}
