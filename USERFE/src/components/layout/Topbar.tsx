import { Bell, Menu, Settings } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { UserMenu } from '@/components/layout/UserMenu'
import { departments, isUnder } from '@/modules/registry'

interface TopbarProps {
  menuOpen: boolean
  onToggleMenu: () => void
}

export function Topbar({ menuOpen, onToggleMenu }: TopbarProps) {
  const { pathname } = useLocation()
  const tool = departments
    .flatMap((department) => department.tools)
    .find((item) => item.status === 'live' && isUnder(pathname, item.basePath))

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button topbar__menu"
        aria-label="Toggle navigation"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        onClick={onToggleMenu}
      >
        <Menu />
      </button>

      {tool ? (
        <nav className="topbar__nav" aria-label={`${tool.name} sections`}>
          <ul>
            {tool.nav.map(({ to, label, icon: TabIcon }) => (
              <li key={to}>
                <NavLink to={to} className="topbar__tab">
                  <TabIcon aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <span className="topbar__spacer" />
      )}

      <div className="topbar__actions">
        <button type="button" className="icon-button" aria-label="Notifications">
          <Bell />
        </button>
        <button type="button" className="icon-button topbar__settings" aria-label="Settings">
          <Settings />
        </button>
        <span className="topbar__divider" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  )
}
