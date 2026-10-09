import { useId, type ReactNode } from 'react'

export interface TabOption<T extends string> {
  value: T
  label: string
}

interface TabsProps<T extends string> {
  label: string
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  children: ReactNode
}

export function Tabs<T extends string>({ label, options, value, onChange, children }: TabsProps<T>) {
  const baseId = useId()
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tabs__list">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`${baseId}-tab-${option.value}`}
            aria-selected={option.value === value}
            aria-controls={`${baseId}-panel`}
            className="tabs__tab"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${value}`} className="tabs__panel">
        {children}
      </div>
    </div>
  )
}
