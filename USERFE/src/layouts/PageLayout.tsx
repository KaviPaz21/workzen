import { Outlet } from 'react-router-dom'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export function PageLayout({ fill = false }: { fill?: boolean }) {
  return (
    <div className={`page${fill ? ' page--fill' : ''}`}>
      <Breadcrumbs />
      <Outlet />
    </div>
  )
}
