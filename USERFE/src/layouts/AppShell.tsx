import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { WorkspaceGate } from '@/components/layout/WorkspaceGate'
import { RecruiteOneStoreProvider } from '@/modules/recruiteone/state/RecruiteOneStore'

function ShellLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    setMenuOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="app-shell__scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="app-shell__body">
        <div className="panel">
          <Topbar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((value) => !value)} />
          <main id="main" ref={mainRef}>
            <WorkspaceGate>
              <Outlet />
            </WorkspaceGate>
          </main>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <RecruiteOneStoreProvider>
      <ShellLayout />
    </RecruiteOneStoreProvider>
  )
}
