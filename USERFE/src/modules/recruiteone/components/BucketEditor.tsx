import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { bucketDefinitions } from '../data/buckets'
import type { BucketKey, Buckets } from '../types'

interface BucketEditorProps {
  buckets: Buckets
  onChange: (buckets: Buckets) => void
}

export function BucketEditor({ buckets, onChange }: BucketEditorProps) {
  const [justAdded, setJustAdded] = useState<string | null>(null)

  function setItem(key: BucketKey, index: number, value: string) {
    onChange({ ...buckets, [key]: buckets[key].map((item, position) => (position === index ? value : item)) })
  }

  function removeItem(key: BucketKey, index: number) {
    onChange({ ...buckets, [key]: buckets[key].filter((_, position) => position !== index) })
  }

  function addItem(key: BucketKey) {
    setJustAdded(`${key}-${buckets[key].length}`)
    onChange({ ...buckets, [key]: [...buckets[key], ''] })
  }

  return (
    <div className="bucket-grid">
      {bucketDefinitions.map(({ key, label, hint }) => (
        <section key={key} className="bucket" aria-labelledby={`bucket-${key}`}>
          <header className="bucket__head">
            <div>
              <h3 id={`bucket-${key}`} className="bucket__title">
                {label}
              </h3>
              <p className="bucket__hint">{hint}</p>
            </div>
            <span className="bucket__count">{buckets[key].length}</span>
          </header>

          <ul className="bucket__list">
            {buckets[key].map((item, index) => (
              <li key={index} className="bucket__item">
                <textarea
                  rows={1}
                  value={item}
                  autoFocus={justAdded === `${key}-${index}`}
                  aria-label={`${label} item ${index + 1}`}
                  onChange={(event) => setItem(key, index, event.target.value)}
                />
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  aria-label={`Delete ${label} item ${index + 1}`}
                  onClick={() => removeItem(key, index)}
                >
                  <Trash2 />
                </button>
              </li>
            ))}
            {buckets[key].length === 0 && <li className="bucket__empty">Nothing found. Add items if needed.</li>}
          </ul>

          <button type="button" className="bucket__add" onClick={() => addItem(key)}>
            <Plus aria-hidden="true" />
            Add item
          </button>
        </section>
      ))}
    </div>
  )
}
