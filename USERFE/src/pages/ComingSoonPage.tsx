import { ArrowRight } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { usePageTitle } from '@/lib/usePageTitle'
import { findPlannedEntry } from '@/modules/registry'
import { NotFoundPage } from '@/pages/NotFoundPage'

const kindLabels = {
  department: 'Department',
  tool: 'Department tool',
  general: 'General tool',
}

export function ComingSoonPage() {
  const { id = '' } = useParams()
  const entry = findPlannedEntry(id)
  usePageTitle(entry ? `${entry.name} (coming soon)` : 'Not found')

  if (!entry) return <NotFoundPage />
  const Icon = entry.icon
  const kind = entry.parent ? `${kindLabels[entry.kind]} in ${entry.parent.name}` : kindLabels[entry.kind]

  return (
    <div className="coming-soon">
      <span className="coming-soon__icon" aria-hidden="true">
        <Icon />
      </span>
      <Badge>Planned</Badge>
      <h1 className="coming-soon__title">{entry.name}</h1>
      <p className="coming-soon__kind">{kind}</p>
      <p className="coming-soon__text">{entry.description}</p>
      <p className="coming-soon__text">
        This is not built yet. RecruiteOne is the first live tool, and more arrive one by one.
      </p>
      <div className="coming-soon__actions">
        <ButtonLink to="/hr/recruiteone/dashboard" icon={<ArrowRight />}>
          Open RecruiteOne
        </ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Back to Home
        </ButtonLink>
      </div>
    </div>
  )
}
