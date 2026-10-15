import { Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { titleCase } from '@/lib/format'
import { approvalReference, approvalStateOf } from '../../services/approvalMath'
import { useStore } from '../../state/RecruiteOneStore'
import type { HiringApproval } from '../../types'
import { ApprovalStateBadge } from '../StatusBadges'

interface ApprovalPickerProps {
  label: string
  approvals: HiringApproval[]
  value: string
  onChange: (id: string) => void
  allowNone?: boolean
  emptyMessage: ReactNode
}

export function ApprovalPicker({ label, approvals, value, onChange, allowNone = false, emptyMessage }: ApprovalPickerProps) {
  const { vacancies } = useStore()
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase()
    return approvals.filter(
      (approval) =>
        term === '' ||
        approval.position_name.toLowerCase().includes(term) ||
        approval.department.toLowerCase().includes(term) ||
        approvalReference(approval).toLowerCase().includes(term),
    )
  }, [approvals, query])

  if (approvals.length === 0) return <div className="notice">{emptyMessage}</div>

  return (
    <div className="approval-picker">
      <label className="search-field jd-search">
        <span className="sr-only">Search hiring approvals</span>
        <Search aria-hidden="true" />
        <input type="search" placeholder="Search by position, department or reference" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <ul className="jd-options" role="radiogroup" aria-label={label}>
        {allowNone && (
          <li>
            <label className={`jd-option${value === '' ? ' jd-option--selected' : ''}`}>
              <input type="radio" name={label} className="radio" checked={value === ''} onChange={() => onChange('')} />
              <span className="jd-option__text">
                <span className="cell-primary">No approval</span>
                <span className="cell-secondary">Leave this unlinked for now.</span>
              </span>
            </label>
          </li>
        )}
        {shown.map((approval) => (
          <li key={approval.id}>
            <label className={`jd-option${approval.id === value ? ' jd-option--selected' : ''}`}>
              <input type="radio" name={label} className="radio" checked={approval.id === value} onChange={() => onChange(approval.id)} />
              <span className="jd-option__text">
                <span className="cell-primary">{approval.position_name}</span>
                <span className="cell-secondary">
                  {approvalReference(approval)} · {approval.department} · {titleCase(approval.level)}
                </span>
              </span>
              <ApprovalStateBadge state={approvalStateOf(approval, vacancies)} />
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="picker__empty">No hiring approval matches your search.</li>}
      </ul>
    </div>
  )
}
