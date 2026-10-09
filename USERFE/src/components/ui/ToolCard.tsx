import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { stagger } from '@/lib/stagger'
import { useToolHighlights } from '@/modules/highlights'
import type { ToolEntry } from '@/modules/registry'

export function ToolCard({ tool, index = 0 }: { tool: ToolEntry; index?: number }) {
  const Icon = tool.icon
  const live = tool.status === 'live'
  const highlights = useToolHighlights(tool.id)

  return (
    <Link
      to={tool.path}
      className={`tool-card tool-card--${tool.status} reveal`}
      style={stagger(index)}
      aria-label={live ? `Open ${tool.name}` : `${tool.name} (planned)`}
    >
      <div className="tool-card__top">
        <span className="tool-card__icon" aria-hidden="true">
          <Icon />
        </span>
        <Badge tone={live ? 'success' : 'neutral'}>{live ? 'Live' : 'Planned'}</Badge>
      </div>
      <h3 className="tool-card__name">{tool.name}</h3>
      <p className="tool-card__tagline">{tool.description}</p>
      {highlights.length > 0 && (
        <ul className="tool-card__highlights">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {live && (
        <span className="tool-card__cta">
          Open {tool.name}
          <ArrowRight aria-hidden="true" />
        </span>
      )}
    </Link>
  )
}
