import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  icon?: ReactNode
  description?: string
  action?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}

export function Card({ title, icon, description, action, flush, className, children }: CardProps) {
  const classes = ['card', flush ? 'card--flush' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <section className={classes}>
      {(title || action) && (
        <header className="card__header">
          <div className="card__heading">
            {icon && (
              <span className="card__icon" aria-hidden="true">
                {icon}
              </span>
            )}
            <div>
              {title && <h2 className="card__title">{title}</h2>}
              {description && <p className="card__description">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}
