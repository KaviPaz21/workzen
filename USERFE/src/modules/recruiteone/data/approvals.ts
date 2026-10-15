import type { BadgeTone } from '@/components/ui/Badge'
import type { ApprovalStepKey, StepDecision } from '../types'
import { financeDepartment, hrDepartment, managementDepartment } from './people'

export type ApprovalState = 'draft' | 'pending' | 'approved' | 'rejected' | 'finished'

export interface StepDefinition {
  key: ApprovalStepKey
  label: string
  shortLabel: string
  department: string | null
}

export const stepDefinitions: StepDefinition[] = [
  { key: 'department_head', label: 'Department head approval', shortLabel: 'Department head', department: null },
  { key: 'finance', label: 'Financial approval', shortLabel: 'Finance', department: financeDepartment },
  { key: 'hr', label: 'HR approval', shortLabel: 'HR', department: hrDepartment },
  { key: 'management', label: 'Final management approval', shortLabel: 'Management', department: managementDepartment },
]

export function stepDefinition(key: ApprovalStepKey) {
  return stepDefinitions.find((definition) => definition.key === key) ?? stepDefinitions[0]
}

export const approvalStateMeta: Record<ApprovalState, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  finished: { label: 'Finished', tone: 'info' },
}

export const decisionMeta: Record<StepDecision, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}
