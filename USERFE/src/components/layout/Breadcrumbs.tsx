import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buildBreadcrumbs } from '@/lib/breadcrumbs'

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const crumbs = buildBreadcrumbs(pathname)

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight aria-hidden="true" className="breadcrumb__separator" />}
            <li>
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
