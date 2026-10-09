import type { BadgeTone } from '@/components/ui/Badge'
import type { Vacancy } from '../types'

export interface VacancyStage {
  label: string
  tone: BadgeTone
}

export function vacancyStage(vacancy: Vacancy): VacancyStage {
  if (vacancy.status === 'closed') return { label: 'Closed', tone: 'neutral' }
  if (vacancy.status === 'on_hold') return { label: 'On hold', tone: 'warning' }
  if (vacancy.status === 'draft') return { label: 'Not started', tone: 'neutral' }
  if (vacancy.evaluated_count === 0) return { label: 'Sourcing', tone: 'info' }
  if (vacancy.evaluated_count < vacancy.candidate_count) return { label: 'Evaluating', tone: 'warning' }
  return { label: 'Shortlisting', tone: 'success' }
}
