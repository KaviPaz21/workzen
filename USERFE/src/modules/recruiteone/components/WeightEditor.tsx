import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { bucketDefinitions, defaultWeights } from '../data/buckets'
import type { Buckets, Weights } from '../types'

interface WeightEditorProps {
  weights: Weights
  buckets: Buckets
  onChange: (weights: Weights) => void
}

export function WeightEditor({ weights, buckets, onChange }: WeightEditorProps) {
  return (
    <div className="weights">
      <div className="weights__intro">
        <p>
          Set how much each category matters when candidates are evaluated for this role. 0% ignores a category and 100%
          makes it count the most. Every category starts at 50%.
        </p>
        <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={() => onChange(defaultWeights())}>
          Reset to 50%
        </Button>
      </div>

      <ul className="weights__list">
        {bucketDefinitions.map(({ key, label }) => (
          <li key={key} className="weight-row">
            <div className="weight-row__label">
              <label htmlFor={`weight-${key}`}>{label}</label>
              <span className="weight-row__count">{buckets[key].length} {buckets[key].length === 1 ? 'item' : 'items'}</span>
            </div>
            <input
              id={`weight-${key}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[key]}
              style={{ '--fill': `${weights[key]}%` } as React.CSSProperties}
              onChange={(event) => onChange({ ...weights, [key]: Number(event.target.value) })}
            />
            <output htmlFor={`weight-${key}`} className="weight-row__value">
              {weights[key]}%
            </output>
          </li>
        ))}
      </ul>
    </div>
  )
}
