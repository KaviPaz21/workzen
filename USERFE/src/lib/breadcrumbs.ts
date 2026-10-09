import { departments, findPlannedEntry, isUnder } from '@/modules/registry'

export interface Crumb {
  label: string
  to?: string
}

export function buildBreadcrumbs(pathname: string): Crumb[] {
  const home: Crumb = { label: 'Home', to: '/' }
  if (pathname === '/') return [{ label: 'Home' }]

  const crumbs: Crumb[] = [home]

  const planned = pathname.match(/^\/soon\/([^/]+)$/)
  if (planned) {
    const entry = findPlannedEntry(planned[1])
    if (entry?.parent) crumbs.push({ label: entry.parent.name, to: entry.parent.path })
    crumbs.push({ label: entry?.name ?? 'Coming soon' })
    return crumbs
  }

  for (const department of departments) {
    if (department.status !== 'live' || !isUnder(pathname, department.path)) continue
    crumbs.push({ label: department.name, to: department.path })
    for (const tool of department.tools) {
      if (tool.status !== 'live' || !isUnder(pathname, tool.basePath)) continue
      crumbs.push({ label: tool.name, to: tool.path })
      const section = tool.nav.find((item) => isUnder(pathname, item.to))
      if (section) crumbs.push({ label: section.label })
    }
  }

  return crumbs.map((crumb, index) => (index === crumbs.length - 1 ? { label: crumb.label } : crumb))
}
