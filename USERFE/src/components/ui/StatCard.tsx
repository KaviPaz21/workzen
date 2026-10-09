import type { CSSProperties } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  index?: number
}

export function StatCard({ label, value, hint, index = 0 }: StatCardProps) {
  return (
    <article className="stat-card reveal" style={{ '--i': index } as CSSProperties}>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {hint && <p className="stat-card__hint">{hint}</p>}
    </article>
  )
}
