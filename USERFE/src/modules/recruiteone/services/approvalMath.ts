import { stepDefinition, stepDefinitions, type ApprovalState } from '../data/approvals'
import { personById } from '../data/people'
import type { ApprovalStep, HiringApproval, Person, Vacancy } from '../types'

export function approvalReference(approval: HiringApproval) {
  return `AP-${approval.id.slice(-6).toUpperCase()}`
}

export function buildSteps(department: string, headId: string): ApprovalStep[] {
  return stepDefinitions.map((definition) => ({
    key: definition.key,
    department: definition.department ?? department,
    approver_id: definition.key === 'department_head' ? headId : null,
    decision: 'pending',
    decided_by: null,
    decided_at: null,
    comment: '',
  }))
}

export function vacanciesOfApproval(approvalId: string, vacancies: Vacancy[]) {
  return vacancies.filter((vacancy) => vacancy.approval_id === approvalId)
}

export function approvalStateOf(approval: HiringApproval, vacancies: Vacancy[]): ApprovalState {
  if (approval.status === 'approved' && vacanciesOfApproval(approval.id, vacancies).some((vacancy) => vacancy.status === 'closed')) return 'finished'
  return approval.status
}

export function currentStepIndex(approval: HiringApproval) {
  if (approval.status !== 'pending') return -1
  return approval.steps.findIndex((step) => step.decision === 'pending')
}

export function stepAllowsPerson(step: ApprovalStep, person: Person) {
  if (step.approver_id) return step.approver_id === person.id
  return step.department === person.department
}

export function canDecide(approval: HiringApproval, person: Person) {
  const index = currentStepIndex(approval)
  return index >= 0 && stepAllowsPerson(approval.steps[index], person)
}

export function stepOwnerLabel(step: ApprovalStep) {
  if (step.approver_id) {
    const person = personById(step.approver_id)
    return person ? `${person.name} · ${person.role}` : 'Unknown approver'
  }
  return `Anyone in ${step.department}`
}

export function stepTitle(step: ApprovalStep) {
  return stepDefinition(step.key).label
}

export function progressLabel(approval: HiringApproval, state: ApprovalState) {
  const total = approval.steps.length
  if (state === 'draft') return 'Not submitted'
  if (state === 'rejected') {
    const rejected = approval.steps.find((step) => step.decision === 'rejected')
    return rejected ? `Rejected at ${stepDefinition(rejected.key).shortLabel}` : 'Rejected'
  }
  if (state === 'approved' || state === 'finished') return `All ${total} approvals done`
  const index = currentStepIndex(approval)
  return index < 0 ? '' : `${stepDefinition(approval.steps[index].key).shortLabel} · ${index + 1} of ${total}`
}

export function usableForJd(approval: HiringApproval, vacancies: Vacancy[]) {
  const state = approvalStateOf(approval, vacancies)
  return state === 'pending' || state === 'approved'
}

export function usableForVacancy(approval: HiringApproval, vacancies: Vacancy[]) {
  return approvalStateOf(approval, vacancies) === 'approved' && vacanciesOfApproval(approval.id, vacancies).length === 0
}

export function isApprovalComplete(input: { position_name: string; recruiter_name: string; department: string; jd_details: string; reason: string; position_value: string }) {
  return (
    input.position_name.trim() !== '' &&
    input.recruiter_name.trim() !== '' &&
    input.department.trim() !== '' &&
    input.jd_details.trim() !== '' &&
    input.reason.trim() !== '' &&
    input.position_value.trim() !== ''
  )
}
