import { ChevronDown, House } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { WorkZenLogo } from '@/components/layout/BrandMark'
import { departments, generalTools, isUnder, type Department } from '@/modules/registry'

interface SidebarProps {
  open: boolean
  onNavigate: () => void
}

function containsPath(department: Department, pathname: string) {
  return isUnder(pathname, department.path) || department.tools.some((tool) => isUnder(pathname, tool.basePath))
}

function activeDepartmentIds(pathname: string) {
  return departments.filter((department) => containsPath(department, pathname)).map((department) => department.id)
}

function SoonTag() {
  return <span className="sr-only"> (coming soon)</span>
}

function DepartmentItem({
  department,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  department: Department
  pathname: string
  expanded: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const Icon = department.icon
  const onOwnPage = pathname === department.path
  const containsActive = containsPath(department, pathname)
  const hasTools = department.tools.length > 0

  return (
    <li>
      <div className="nav-row">
        <Link
          to={department.path}
          className={`nav-link${containsActive && !onOwnPage ? ' nav-link--parent' : ''}${department.status === 'planned' ? ' nav-link--soon' : ''}`}
          aria-current={onOwnPage ? 'page' : undefined}
          onClick={onNavigate}
        >
          <Icon aria-hidden="true" />
          <span>{department.name}</span>
          {department.status === 'planned' && <SoonTag />}
        </Link>
        {hasTools && (
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${department.name}`}
            onClick={onToggle}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      </div>

      {hasTools && expanded && (
        <ul className="nav-children" aria-label={`${department.name} tools`}>
          {department.tools.map((tool) => {
            const ToolIcon = tool.icon
            const active = isUnder(pathname, tool.basePath)
            return (
              <li key={tool.id}>
                <Link
                  to={tool.path}
                  className={`nav-link${tool.status === 'planned' ? ' nav-link--soon' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  <ToolIcon aria-hidden="true" />
                  <span>{tool.name}</span>
                  {tool.status === 'planned' && <SoonTag />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeDepartmentIds(pathname)))

  useEffect(() => {
    setExpanded((current) => new Set([...current, ...activeDepartmentIds(pathname)]))
  }, [pathname])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside id="app-sidebar" className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <Link to="/" className="sidebar__brand" aria-label="WorkZen home" onClick={onNavigate}>
        <WorkZenLogo onDark />
      </Link>

      <nav className="sidebar__nav" aria-label="Main">
        <ul className="nav-list">
          <li>
            <Link to="/" className="nav-link" aria-current={pathname === '/' ? 'page' : undefined} onClick={onNavigate}>
              <House aria-hidden="true" />
              <span>Home</span>
            </Link>
          </li>
        </ul>

        <p className="nav-section" id="nav-departments">
          Departments
        </p>
        <ul className="nav-list" aria-labelledby="nav-departments">
          {departments.map((department) => (
            <DepartmentItem
              key={department.id}
              department={department}
              pathname={pathname}
              expanded={expanded.has(department.id)}
              onToggle={() => toggle(department.id)}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        <p className="nav-section" id="nav-general">
          General tools
        </p>
        <ul className="nav-list" aria-labelledby="nav-general">
          {generalTools.map((tool) => {
            const Icon = tool.icon
            return (
              <li key={tool.id}>
                <Link
                  to={tool.path}
                  className={`nav-link${tool.status === 'planned' ? ' nav-link--soon' : ''}`}
                  aria-current={pathname === tool.path ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" />
                  <span>{tool.name}</span>
                  {tool.status === 'planned' && <SoonTag />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
