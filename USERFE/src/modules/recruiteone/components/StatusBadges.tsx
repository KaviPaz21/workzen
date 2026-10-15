import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { approvalStateMeta, type ApprovalState } from '../data/approvals'
import type { JdState } from '../state/RecruiteOneStore'
import type { CandidateStatus, Recommendation, VacancyStatus } from '../types'

interface Meta {
  label: string
  tone: BadgeTone
}

const jdMeta: Record<JdState, Meta> = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  inactive: { label: 'No active vacancy', tone: 'warning' },
  deleted: { label: 'Deleted', tone: 'danger' },
}

const vacancyMeta: Record<VacancyStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Open', tone: 'success' },
  on_hold: { label: 'On hold', tone: 'warning' },
  closed: { label: 'Closed', tone: 'danger' },
}

const candidateMeta: Record<CandidateStatus, Meta> = {
  new: { label: 'New', tone: 'info' },
  shortlisted: { label: 'Shortlisted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const recommendationMeta: Record<Recommendation, Meta> = {
  strong_match: { label: 'Strong match', tone: 'success' },
  potential_match: { label: 'Potential match', tone: 'warning' },
  not_a_match: { label: 'Not a match', tone: 'danger' },
}

export function ApprovalStateBadge({ state }: { state: ApprovalState }) {
  return <Badge tone={approvalStateMeta[state].tone}>{approvalStateMeta[state].label}</Badge>
}

export function JdStatusBadge({ state }: { state: JdState }) {
  return <Badge tone={jdMeta[state].tone}>{jdMeta[state].label}</Badge>
}

export function vacancyStatusLabel(status: VacancyStatus) {
  return vacancyMeta[status].label
}

export function VacancyStatusBadge({ status }: { status: VacancyStatus }) {
  return <Badge tone={vacancyMeta[status].tone}>{vacancyMeta[status].label}</Badge>
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  return <Badge tone={candidateMeta[status].tone}>{candidateMeta[status].label}</Badge>
}

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  return <Badge tone={recommendationMeta[recommendation].tone}>{recommendationMeta[recommendation].label}</Badge>
}
