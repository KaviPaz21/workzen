import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { hrDepartment, people, personById } from '../data/people'

interface InterviewerPickerProps {
  label: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function InterviewerPicker({ label, selectedIds, onChange }: InterviewerPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const term = query.trim().toLowerCase()
  const shown = people.filter((person) => term === '' || person.name.toLowerCase().includes(term) || person.role.toLowerCase().includes(term))

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
  }

  return (
    <div className="picker">
      <div className="picker__chips">
        {selectedIds.map((id) => {
          const person = personById(id)
          if (!person) return null
          return (
            <span key={id} className="picker__chip">
              {person.name}
              <button type="button" aria-label={`Remove ${person.name} from ${label}`} onClick={() => toggle(id)}>
                <X aria-hidden="true" />
              </button>
            </span>
          )
        })}
        <button type="button" className="picker__add" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Plus aria-hidden="true" />
          {open ? 'Done' : 'Add'}
        </button>
      </div>

      {open && (
        <div className="picker__panel">
          <input
            className="input picker__search"
            placeholder="Search people"
            aria-label={`Search interviewers for ${label}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="picker__list">
            {shown.map((person) => (
              <li key={person.id}>
                <label className="picker__row">
                  <input type="checkbox" className="checkbox" checked={selectedIds.includes(person.id)} onChange={() => toggle(person.id)} />
                  <span className="picker__name">{person.name}</span>
                  <span className="picker__role">
                    {person.role}
                    {person.department === hrDepartment ? ' · HR' : ''}
                  </span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="picker__empty">No one matches that search.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
