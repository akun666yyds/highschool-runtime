import { BarChart3, LayoutDashboard, LibraryBig, Settings2 } from 'lucide-react'
import type { Route } from '../App'
import type { Profile } from '../lib/storage'

interface Props {
  route: Route
  profile: Profile
  paperCount: number
  gradingCount: number
  onNavigate: (route: Route) => void
}

export function Sidebar({ route, profile, paperCount, gradingCount, onNavigate }: Props) {
  const section =
    route.name === 'dashboard'
      ? 'dashboard'
      : route.name === 'records' || route.name === 'result'
        ? 'records'
        : 'library'

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-seal">高</div>
        <div>
          <div className="brand-title">高考年华</div>
          <div className="brand-sub">Highschool Runtime</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item ${section === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'dashboard' })}
        >
          <LayoutDashboard size={18} strokeWidth={1.7} />
          <span>今日</span>
          <span className="nav-caption">TODAY</span>
        </button>
        <button
          type="button"
          className={`nav-item ${section === 'library' ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'library' })}
        >
          <LibraryBig size={18} strokeWidth={1.7} />
          <span>题库</span>
          <span className="nav-caption">LIBRARY</span>
        </button>
        <button
          type="button"
          className={`nav-item ${section === 'records' ? 'active' : ''}`}
          onClick={() => onNavigate({ name: 'records' })}
        >
          <BarChart3 size={18} strokeWidth={1.7} />
          <span>战绩</span>
          <span className="nav-caption">RECORDS</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="data-status">
        <div className="data-status-head">
          <span className="pulse-dot" />
          <span>题库已自动就绪</span>
        </div>
        <p>
          已载入 <b>{paperCount}</b> 套试卷
          {gradingCount > 0 ? ` · ${gradingCount} 场待评卷` : ' · 江苏 / 上海优先'}
        </p>
      </div>

      <div className="profile">
        <div className="avatar">{profile.name.slice(0, 1)}</div>
        <div className="profile-text">
          <strong>{profile.name}</strong>
          <span>{profile.targetYear} 届考生</span>
        </div>
        <Settings2 size={17} strokeWidth={1.6} className="profile-gear" />
      </div>
    </aside>
  )
}
