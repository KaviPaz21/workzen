import { ClipboardCheck, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField } from '@/components/ui/SearchField'
import { formatDate, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { ApprovalDetailModal } from '../components/approval/ApprovalDetailModal'
import { ApprovalFormModal } from '../components/approval/ApprovalFormModal'
import { ApprovalStateBadge } from '../components/StatusBadges'
import type { ApprovalState } from '../data/approvals'
import { approvalReference, approvalStateOf, canDecide, progressLabel, vacanciesOfApproval } from '../services/approvalMath'
import { useCurrentUser } from '../state/CurrentUser'
import { useStore } from '../state/RecruiteOneStore'
import type { HiringApproval } from '../types'

type Filter = 'all' | ApprovalState

const emptyText: Record<Filter, string> = {
  all: 'Create a hiring request to start the approval flow.',
  draft: 'Requests you save without submitting are kept here.',
  pending: 'Requests waiting for an approver appear here.',
  approved: 'Requests approved by everyone appear here. They can be linked to a job description and a vacancy.',
  rejected: 'Requests turned down by an approver appear here.',
  finished: 'When a vacancy linked to an approved request is closed, the request moves here.',
}

export function ApprovalsPage() {
  usePageTitle('Approvals')
  const { approvals, vacancies, jds } = useStore()
  const { user } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<{ approval: HiringApproval | null } | null>(null)

  const states = useMemo(() => new Map(approvals.map((approval) => [approval.id, approvalStateOf(approval, vacancies)])), [approvals, vacancies])
  const countState = (state: ApprovalState) => approvals.filter((approval) => states.get(approval.id) === state).length
  const awaitingMe = approvals.filter((approval) => canDecide(approval, user)).length

  const options: FilterOption<Filter>[] = [
    { value: 'all', label: 'All', count: approvals.length },
    { value: 'draft', label: 'Drafts', count: countState('draft') },
    { value: 'pending', label: 'Pending', count: countState('pending') },
    { value: 'approved', label: 'Approved', count: countState('approved') },
    { value: 'rejected', label: 'Rejected', count: countState('rejected') },
    { value: 'finished', label: 'Finished', count: countState('finished') },
  ]

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return approvals.filter((approval) => {
      const matchesFilter = filter === 'all' || states.get(approval.id) === filter
      const matchesQuery =
        term === '' ||
        approval.position_name.toLowerCase().includes(term) ||
        approval.department.toLowerCase().includes(term) ||
        approval.recruiter_name.toLowerCase().includes(term) ||
        approvalReference(approval).toLowerCase().includes(term)
      return matchesFilter && matchesQuery
    })
  }, [approvals, states, query, filter])

  function usedBy(approval: HiringApproval) {
    const linkedJds = jds.filter((jd) => jd.approval_id === approval.id)
    const linkedVacancies = vacanciesOfApproval(approval.id, vacancies)
    if (linkedJds.length === 0 && linkedVacancies.length === 0) return '—'
    const parts = []
    if (linkedJds.length > 0) parts.push(`${linkedJds.length} JD`)
    if (linkedVacancies.length > 0) parts.push(`${linkedVacancies.length} ${linkedVacancies.length === 1 ? 'vacancy' : 'vacancies'}`)
    return parts.join(' · ')
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Every new hire starts as a hiring request. It must pass the department head, finance, HR and final management before a vacancy can be opened."
        actions={
          <Button icon={<Plus />} onClick={() => setForm({ approval: null })}>
            New hiring request
          </Button>
        }
      />

      <Card flush className="reveal card--fill">
        <div className="toolbar">
          <FilterTabs label="Filter hiring requests" options={options} value={filter} onChange={setFilter} />
          <div className="toolbar__group">
            {awaitingMe > 0 && <Badge tone="warning">{awaitingMe} waiting for you</Badge>}
            <SearchField label="Search hiring requests" placeholder="Search position, department or recruiter" value={query} onChange={setQuery} />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title={approvals.length === 0 ? 'No hiring requests yet' : 'No hiring requests here'}
            description={approvals.length === 0 ? emptyText.all : query.trim() !== '' ? 'Try a different search.' : emptyText[filter]}
            action={
              approvals.length === 0 ? (
                <Button icon={<Plus />} onClick={() => setForm({ approval: null })}>
                  New hiring request
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Hiring request</th>
                  <th scope="col">Level</th>
                  <th scope="col">Recruiter</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Used by</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((approval) => {
                  const state = states.get(approval.id) ?? approval.status
                  return (
                    <tr key={approval.id} className="row-clickable" onClick={() => setDetailId(approval.id)}>
                      <td className="cell-wide">
                        <button type="button" className="link-button" onClick={() => setDetailId(approval.id)}>
                          {approval.position_name}
                        </button>
                        <p className="cell-secondary">
                          {approvalReference(approval)} · {approval.department}
                        </p>
                      </td>
                      <td>{titleCase(approval.level)}</td>
                      <td>{approval.recruiter_name}</td>
                      <td className="nowrap">
                        {progressLabel(approval, state)}
                        {canDecide(approval, user) && (
                          <>
                            {' '}
                            <Badge tone="warning">Your turn</Badge>
                          </>
                        )}
                      </td>
                      <td className="cell-secondary nowrap">{usedBy(approval)}</td>
                      <td>
                        <ApprovalStateBadge state={state} />
                      </td>
                      <td className="cell-secondary">{formatDate(approval.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          Showing {rows.length} of {approvals.length} hiring requests
        </div>
      </Card>

      {detailId && (
        <ApprovalDetailModal
          approvalId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(approval) => {
            setDetailId(null)
            setForm({ approval })
          }}
        />
      )}

      {form && <ApprovalFormModal approval={form.approval} onClose={() => setForm(null)} />}
    </>
  )
}
